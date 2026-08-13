import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createServiceClient } from './supabase';

// Client auth: Google OAuth with Calendar scopes (Constraints: client auth = Google OAuth,
// scope calendar.readonly + calendar read/write per SCHEDULING_APP_ORCHESTRATION.md #7).
//
// A second, admin/password provider is added below for click-through testing before a real
// Google Cloud OAuth app exists. It is INSECURE (hardcoded-style default credentials, no
// rate limiting, no lockout) and must stay disabled (ALLOW_ADMIN_LOGIN unset/false) for any
// real client rollout — see README "Admin login (testing only)" for the full warning.
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
      async authorize(credentials) {
        const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
        const expectedPassword = process.env.ADMIN_PASSWORD || 'admin1';
        if (
          credentials?.username === expectedUsername &&
          credentials?.password === expectedPassword
        ) {
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

      await supabase.from('clients').upsert(
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
      );

      return true;
    },
    async session({ session }) {
      if (!session.user?.email) return session;
      const supabase = createServiceClient();
      const { data: client } = await supabase
        .from('clients')
        .select('id, timezone')
        .eq('email', session.user.email)
        .maybeSingle();
      if (client) {
        (session as any).clientId = client.id;
        (session as any).timezone = client.timezone;
      }
      return session;
    },
  },
};
