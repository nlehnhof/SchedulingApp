import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import DashboardChrome from '@/components/DashboardChrome';
import SignInButton from '@/components/SignInButton';
import AdminLoginForm from '@/components/AdminLoginForm';
import { CALENDAR_COOKIE_NAME } from '@/components/CalendarContext';
import type { Tier } from '@/lib/tier';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const adminLoginEnabled = process.env.ALLOW_ADMIN_LOGIN === 'true';

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
        <div className="flex flex-col items-center gap-4">
          <span className="font-serif text-2xl font-semibold text-text-primary">Gather</span>
          <h1 className="text-lg font-medium text-text-primary">Client sign-in required</h1>
          <p className="text-sm text-text-secondary">
            Sign in with the Google account tied to your scheduling app.
          </p>
          <SignInButton />
        </div>
        {adminLoginEnabled && (
          <div className="flex w-full max-w-xs flex-col items-center gap-3 border-t border-border pt-6">
            <p className="text-center text-xs text-danger">
              Testing mode: admin login is enabled. Disable ALLOW_ADMIN_LOGIN before any real
              client uses this deployment.
            </p>
            <AdminLoginForm />
          </div>
        )}
      </main>
    );
  }

  const sessionTier = (session as any).tier;
  const tier: Tier =
    sessionTier === 'elite' ? 'elite' : sessionTier === 'premium' ? 'premium' : 'free';
  const tutorialCompletedAt = (session as any).tutorialCompletedAt ?? null;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.test';
  const isAdminTestAccount = adminLoginEnabled && session.user?.email === adminEmail;
  // Read once server-side so a hard reload of e.g. /dashboard/rules doesn't
  // flash the wrong calendar's data before the client corrects it — see
  // components/CalendarContext.tsx for the rest of the selection logic.
  const initialCalendarId = cookies().get(CALENDAR_COOKIE_NAME)?.value ?? null;

  return (
    <DashboardChrome
      email={session.user?.email}
      tier={tier}
      tutorialCompletedAt={tutorialCompletedAt}
      isAdminTestAccount={isAdminTestAccount}
      initialCalendarId={initialCalendarId}
    >
      {children}
    </DashboardChrome>
  );
}
