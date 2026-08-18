import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createServiceClient } from './supabase';
import { safeCompare } from './safe-compare';
import { isRateLimited } from './rate-limit';
import { getEffectiveTier } from './premium-grants';

// Client auth: Google OAuth with the narrowest Calendar scopes this app actually calls.
// SCHEDULING_APP_ORCHESTRATION.md #7 specified `calendar.readonly` + full `calendar`. Both
// are wider than anything in lib/google-calendar.ts needs, and full `calendar` renders on
// the consent screen as "See, edit, share, and permanently delete all the calendars you can
// access" - a hard sell to a church secretary, and a harder one to Google's sensitive-scope
// reviewers, who require each requested scope to be the narrowest one that works. Every
// Calendar scope is still "sensitive", so verification is required either way; narrowing
// only makes the justification defensible and the consent screen honest. Scope-to-call-site
// mapping is inline below - if you add a Google Calendar call, check it against this list.
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
          // Read + write events on whichever calendar the client picked: the
          // 30-min poller (getGoogleCalendarEvents), the live availability
          // fetch, and the booking write-back (create/update/delete
          // GoogleCalendarEvent) - all in lib/google-calendar.ts. Deliberately
          // NOT the narrower `calendar.events.owned`: this app supports polling
          // and writing to a calendar that was *shared* with the client (a
          // church's shared "Building" or "Counseling" calendar is the whole
          // point of the picker), and `.owned` covers only calendars they own.
          'https://www.googleapis.com/auth/calendar.events',
          // Read-only list of the client's calendars, for the picker on
          // /dashboard/calendar (listGoogleCalendars). Nothing in this app
          // creates, renames, subscribes to, unsubscribes from, or changes the
          // sharing of a calendar, so none of `calendar.calendars*`, the
          // writable `calendar.calendarlist`, or `calendar.acls*` are requested.
          'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
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
      const email = user.email.toLowerCase();

      const supabase = createServiceClient();
      const existing = await supabase
        .from('clients')
        .select('id, google_refresh_token')
        .eq('email', user.email)
        .maybeSingle();

      // A person invited as a collaborator (Elite team access — 0018
      // migration) who has never owned their own account must NOT get a new
      // owner `clients` row created for them just by signing in — that
      // would silently give them a second, independent, empty account
      // instead of landing them in the calendar(s) they were actually
      // invited to. An existing owner's own row always takes priority
      // (checked first, via `existing` above) — being invited elsewhere
      // never demotes or replaces someone's own account.
      if (!existing.data) {
        const { count: collaboratorRowCount } = await supabase
          .from('client_collaborators')
          .select('id', { count: 'exact', head: true })
          .eq('email', email);
        if (collaboratorRowCount) {
          // Stamp any pending invite(s) for this email as accepted on this,
          // their first-ever sign-in — see lib/require-client.ts /
          // session() below for how this then resolves into the owner's
          // calendar(s) with the assigned role, no separate "accept" step.
          await supabase
            .from('client_collaborators')
            .update({ accepted_at: new Date().toISOString() })
            .eq('email', email)
            .is('accepted_at', null);
          return true;
        }
      }

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

      // An owner can also be invited as a collaborator elsewhere (a second
      // calendar/account they don't own) — their own row still wins for
      // default session identity (below), but any pending invite for them
      // should still get accepted on sign-in so it shows up in the
      // calendar switcher's "shared with you" group.
      await supabase
        .from('client_collaborators')
        .update({ accepted_at: new Date().toISOString() })
        .eq('email', email)
        .is('accepted_at', null);

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
      } else {
        (session as any).clientId = null;
      }

      // Elite team access (0018 migration): every calendar this email has
      // *accepted* collaborator access to, regardless of who owns it —
      // resolved separately from the owner `clientId` above so a person can
      // be both an owner (their own calendars) and a collaborator elsewhere
      // (someone else's) at once. Only accepted rows count — a still-pending
      // invite is stamped accepted_at automatically on the invitee's next
      // sign-in (see the signIn callback above), not before.
      const { data: collaborations } = await supabase
        .from('client_collaborators')
        .select('role, booking_calendars(id, client_id, display_name)')
        .eq('email', session.user.email.toLowerCase())
        .not('accepted_at', 'is', null);
      (session as any).collaboratorCalendars = (collaborations ?? [])
        .map((row: any) => {
          const cal = Array.isArray(row.booking_calendars) ? row.booking_calendars[0] : row.booking_calendars;
          if (!cal) return null;
          return {
            calendarId: cal.id,
            clientId: cal.client_id,
            calendarDisplayName: cal.display_name,
            role: row.role as 'viewer' | 'editor',
          };
        })
        .filter(Boolean);
      (session as any).isCollaboratorOnly = !client && (session as any).collaboratorCalendars.length > 0;

      return session;
    },
  },
};
