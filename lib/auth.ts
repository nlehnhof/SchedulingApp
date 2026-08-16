import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createServiceClient } from './supabase';
import { safeCompare } from './safe-compare';
import { isRateLimited } from './rate-limit';
import { getEffectiveTier } from './premium-grants';

// Client auth: Google OAuth with Calendar scopes (Constraints: client auth = Google OAuth,
// scope calendar.readonly + calendar read/write per SCHEDULING_APP_ORCHESTRATION.md #7).
//
// A second, admin/password provider is added below for click-through testing before a real
// Google Cloud OAuth app exists. It is a fixed, low-entropy default credential — even with
// the rate limiting and constant-time comparison added below (security review 2026-08-13),
// it must stay disabled (ALLOW_ADMIN_LOGIN unset/false) for any real client rollout — see
// README "Admin login (testing only)" for the full warning.
const providers: NextAuthOptions['providers'] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    authorization: {
      params: {
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar',
        ].join(' '),
        access_type: 'offline', // required to receive a refresh_token
        prompt: 'consent', // force refresh_token on every sign-in (Google only sends it once otherwise)
      },
    },
  }),
];

if (process.env.ALLOW_ADMIN_LOGIN === 'true') {
  providers.push(
    CredentialsProvider({
      id: 'admin',
      name: 'Admin (testing only)',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        // Rate-limit by caller IP before even checking the password, so this
        // can't be brute-forced by scripting repeated sign-in attempts.
        const ip =
          (req?.headers as Record<string, string> | undefined)?.['x-forwarded-for']
            ?.split(',')[0]
            ?.trim() || 'unknown';
        if (isRateLimited(`admin-login:${ip}`, 5, 5 * 60 * 1000)) {
          throw new Error('Too many attempts. Try again in a few minutes.');
        }

        const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
        const expectedPassword = process.env.ADMIN_PASSWORD || 'admin1';
        const usernameOk =
          !!credentials?.username && safeCompare(credentials.username, expectedUsername);
        const passwordOk =
          !!credentials?.password && safeCompare(credentials.password, expectedPassword);
        if (usernameOk && passwordOk) {
          // No real Google account behind this login, so no Google Calendar
          // sync will run for it (google_refresh_token stays null) — fine
          // for clicking through rules/reasons/schedule/booking/export.
          return {
            id: 'admin-credentials-login',
            email: process.env.ADMIN_EMAIL || 'admin@local.test',
            name: 'Admin (test account)',
          };
        }
        return null;
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      const supabase = createServiceClient();
      const existing = await supabase
        .from('clients')
        .select('id, google_refresh_token')
        .eq('email', user.email)
        .maybeSingle();

      const { data: upserted } = await supabase
        .from('clients')
        .upsert(
          {
            email: user.email,
            google_id: account.providerAccountId,
            // Google only returns a refresh_token on first consent; keep the
            // existing one on subsequent logins instead of overwriting with null.
            // (The admin credentials provider never has one, so this stays null.)
            google_refresh_token:
              account.refresh_token ?? existing.data?.google_refresh_token ?? null,
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single();

      // Every client needs at least one booking_calendars row to do
      // anything (rules/reasons/appointments are all calendar-scoped now —
      // 0014-0016 migrations). A client who already existed before that
      // migration got one via its backfill; a brand-new signup has none yet,
      // so create a default one here, using the client's own id so a fresh
      // account's first calendar behaves the same simple way an old
      // single-calendar account already does.
      if (upserted) {
        const { count } = await supabase
          .from('booking_calendars')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', upserted.id);
        if (!count) {
          await supabase
            .from('booking_calendars')
            .insert({ id: upserted.id, client_id: upserted.id });
        }
      }

      return true;
    },
    async session({ session }) {
      if (!session.user?.email) return session;
      const supabase = createServiceClient();
      // JWT session strategy, but this callback still does a fresh DB
      // round-trip on every getServerSession() call (scoped by email, as
      // before) — so tier/tutorialCompletedAt are never stale/cached in the
      // token itself. That matters because every premium-gated route reads
      // tier from the session rather than re-querying: it must always
      // reflect the client row's *current* value, never something a
      // request could influence (see PLAN.md Section 5).
      const { data: client } = await supabase
        .from('clients')
        .select('id, tier, tutorial_completed_at')
        .eq('email', session.user.email)
        .maybeSingle();
      if (client) {
        (session as any).clientId = client.id;
        // Layers the premium_grants allowlist on top of the raw DB column —
        // see lib/premium-grants.ts. This is the single place that decision
        // gets made for every session-based (requireClient()) route, so a
        // granted client shows as premium everywhere without clients.tier
        // itself ever being touched.
        (session as any).tier = await getEffectiveTier(client.tier ?? 'free', session.user.email);
        (session as any).tutorialCompletedAt = client.tutorial_completed_at ?? null;
      }
      return session;
    },
  },
};
