import { createServiceClient } from './supabase';
import type { Tier } from './tier';

/**
 * Premium trial/comp feature: some client accounts get 'premium' access
 * indefinitely because their email is listed in the `premium_grants` table
 * (supabase/migrations/0010_premium_grants.sql), independent of Stripe
 * billing. Managed directly via the Supabase SQL Editor — there's no admin
 * UI for this by design (a handful of comped accounts don't need one):
 *
 *   insert into premium_grants (email, note) values ('someone@example.com', 'why');
 *   delete from premium_grants where email = 'someone@example.com';
 *
 * Checked live on every call (never cached or written onto clients.tier) so
 * a grant added after a client has already signed up takes effect on their
 * very next request, and a grant added before they've ever signed up
 * applies from their first login — no re-sync step either way.
 *
 * `clients.tier` itself stays exactly what it was before this feature: the
 * single column the Stripe webhook writes (app/api/stripe/webhook/route.ts)
 * and every route reads. getEffectiveTier() layers the grants table on top
 * of that column rather than replacing it, so Stripe stays the source of
 * truth for real subscriptions and this is purely additive.
 *
 * Every place in the app that turns a client's raw `tier` column into an
 * authorization decision needs to go through getEffectiveTier() instead of
 * reading `tier` directly, or a granted client won't actually see the
 * premium features they were promised. Current call sites: lib/auth.ts's
 * session callback (covers everything gated via lib/require-client.ts —
 * branding, analytics, reminders, dashboard nav/home), lib/booking.ts
 * (auto-confirmation email), lib/resolve-client-link.ts (custom slug),
 * app/api/visitor/[clientLink]/availability/route.ts (visitor-facing
 * branding), app/api/client/billing/route.ts and
 * app/api/client/dashboard/route.ts (display), and
 * app/api/cron/sms-reminders/route.ts (opt-in query).
 */
export async function isEmailGranted(email: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('premium_grants')
    .select('email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return !!data;
}

/**
 * A grant always wins — 'indefinitely', regardless of Stripe subscription
 * state — but never downgrades: a client who's already premium or elite via
 * Stripe reads as that tier without needing a grants-table round trip.
 * `premium_grants` only ever grants 'premium', never 'elite' — there's no
 * comp path onto the Elite tier today, since it wasn't a bought-and-paid-for
 * tier when this table was designed.
 */
export async function getEffectiveTier(dbTier: Tier, email: string): Promise<Tier> {
  if (dbTier === 'elite' || dbTier === 'premium') return dbTier;
  return (await isEmailGranted(email)) ? 'premium' : 'free';
}
