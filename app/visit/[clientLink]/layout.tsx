import type { Metadata, Viewport } from 'next';
import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase';
import { resolveCalendarLink } from '@/lib/resolve-calendar-link';
import { getEffectiveTier } from '@/lib/premium-grants';
import { isAtLeast } from '@/lib/tier';

// cache() dedupes this across generateMetadata + generateViewport within the
// same request — Next.js 14 splits theme-color out of `metadata` into a
// separate `viewport` export (the old metadata.themeColor is deprecated),
// so both need the same calendar/owner lookup.
const getVisitorPageInfo = cache(async (clientLink: string) => {
  const resolved = await resolveCalendarLink(clientLink);
  if (!resolved) return null;

  const supabase = createServiceClient();
  const { data: calendar } = await supabase
    .from('booking_calendars')
    .select('display_name, accent_color, clients(email, tier)')
    .eq('id', resolved.calendarId)
    .maybeSingle();
  if (!calendar) return null;

  // Same defensive array-or-object handling as resolveCalendarLink/the
  // availability route — Supabase's nested-relation shape varies.
  const owner: any = Array.isArray((calendar as any).clients)
    ? (calendar as any).clients[0]
    : (calendar as any).clients;

  const displayName: string | null = calendar.display_name || owner?.email || null;
  const isPremium = owner
    ? isAtLeast(await getEffectiveTier(owner.tier, owner.email), 'premium')
    : false;

  return {
    displayName,
    // Theme color (browser chrome tint) is gated the same way branding.accentColor
    // already is on the visitor page itself — a free/downgraded client's page
    // stays default-styled everywhere, including here.
    accentColor: isPremium ? (calendar.accent_color as string | null) : null,
  };
});

export async function generateMetadata({
  params,
}: {
  params: { clientLink: string };
}): Promise<Metadata> {
  const info = await getVisitorPageInfo(params.clientLink);
  return {
    title: info?.displayName ? `Book with ${info.displayName}` : 'Book an Appointment',
  };
}

export async function generateViewport({
  params,
}: {
  params: { clientLink: string };
}): Promise<Viewport> {
  const info = await getVisitorPageInfo(params.clientLink);
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: info?.accentColor ?? undefined,
  };
}

export default function VisitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
