import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { requireCalendarAccess, requireWriteRole, calendarOwnerTier } from '@/lib/require-calendar';
import { brandingSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { isAtLeast } from '@/lib/tier';

// Read-only, open to any authenticated client (not tier-gated) — a
// below-premium client still needs to see their own current values so the
// Branding page can render the locked/upsell panel with something to show.
// Scoped to one booking_calendars row (?calendarId=) — no cross-tenant data
// here, just a calendar the caller owns or collaborates on.
export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_calendars')
    .select('id, display_name, accent_color, logo_url, slug')
    .eq('id', calendar.calendarId)
    .single();

  if (error) return errorResponse(error, 'Could not load branding settings.');

  return NextResponse.json({
    id: data.id,
    display_name: data.display_name,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    slug: data.slug,
    tier: await calendarOwnerTier(calendar.calendarId),
  });
}

// The actual write path for premium features 1 (branding) and 2 (slug) —
// both persist through this one route, scoped to one booking_calendars
// row. Must check the owning calendar's tier is premium-or-above
// server-side regardless of what the UI already hides, per PLAN.md
// Section 5: a free-tier client hand-crafting this request must get a 403.
export async function PATCH(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const calendar = await requireCalendarAccess(searchParams.get('calendarId'), client);
  if (calendar instanceof NextResponse) return calendar;
  const writeError = requireWriteRole(calendar.role);
  if (writeError) return writeError;

  const ownerTier = await calendarOwnerTier(calendar.calendarId);
  if (!isAtLeast(ownerTier, 'premium')) {
    return NextResponse.json({ error: 'Branding is a premium feature.' }, { status: 403 });
  }

  const parsed = brandingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const update: Record<string, unknown> = {};
  if (body.displayName !== undefined) update.display_name = body.displayName;
  if (body.accentColor !== undefined) update.accent_color = body.accentColor;
  if (body.logoUrl !== undefined) update.logo_url = body.logoUrl;
  if (body.slug !== undefined) update.slug = body.slug;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_calendars')
    .update(update)
    .eq('id', calendar.calendarId)
    .select('id, display_name, accent_color, logo_url, slug')
    .single();

  if (error) {
    // Unique index on slug (0014 migration) — someone else already has it.
    if ((error as any).code === '23505') {
      return errorResponse(error, 'That booking link is already taken. Try a different one.', 409);
    }
    return errorResponse(error, 'Could not save branding changes.');
  }

  return NextResponse.json({
    id: data.id,
    display_name: data.display_name,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    slug: data.slug,
    tier: ownerTier,
  });
}
