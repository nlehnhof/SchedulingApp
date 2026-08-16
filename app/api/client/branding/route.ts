import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { brandingSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';
import { getEffectiveTier } from '@/lib/premium-grants';
import { isAtLeast } from '@/lib/tier';

// Read-only, open to any authenticated client (not premium-gated) — a
// free-tier client still needs to see their own current tier/values so the
// Branding page can render the locked/upsell panel with something to show.
// No sensitive cross-tenant data here, just the caller's own row. Also
// backs the Reminders page (app/dashboard/reminders/page.tsx), which reuses
// this same route rather than having its own.
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, email, display_name, accent_color, logo_url, slug, tier, sms_reminders_enabled')
    .eq('id', client.clientId)
    .single();

  if (error) return errorResponse(error, 'Could not load branding settings.');

  // Effective tier (raw column or a live premium_grants override — see
  // lib/premium-grants.ts), so a comped client actually sees the
  // Branding/Reminders forms instead of the locked upsell panel.
  const tier = await getEffectiveTier(data.tier, data.email);
  return NextResponse.json({
    id: data.id,
    display_name: data.display_name,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    slug: data.slug,
    tier,
    sms_reminders_enabled: data.sms_reminders_enabled,
  });
}

// The actual write path for premium features 1 (branding) and 2 (slug) —
// both persist through this one route. Must check tier is premium-or-above
// server-side regardless of what the UI already hides, per PLAN.md
// Section 5: a free-tier client hand-crafting this request must get a 403.
// `client.tier` here already reflects premium_grants (lib/auth.ts's session
// callback computes it), so a comped account can save branding too.
export async function PATCH(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  if (!isAtLeast(client.tier, 'premium')) {
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
  if (body.smsRemindersEnabled !== undefined) update.sms_reminders_enabled = body.smsRemindersEnabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .update(update)
    .eq('id', client.clientId)
    .select('id, email, display_name, accent_color, logo_url, slug, tier, sms_reminders_enabled')
    .single();

  if (error) {
    // Unique index on slug (0007 migration) — someone else already has it.
    if ((error as any).code === '23505') {
      return errorResponse(error, 'That booking link is already taken. Try a different one.', 409);
    }
    return errorResponse(error, 'Could not save branding changes.');
  }

  const tier = await getEffectiveTier(data.tier, data.email);
  return NextResponse.json({
    id: data.id,
    display_name: data.display_name,
    accent_color: data.accent_color,
    logo_url: data.logo_url,
    slug: data.slug,
    tier,
    sms_reminders_enabled: data.sms_reminders_enabled,
  });
}
