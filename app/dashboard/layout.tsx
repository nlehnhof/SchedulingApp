import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import Link from 'next/link';
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
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-canvas p-8">
        <div className="flex flex-col items-center gap-4">
          <span className="font-display text-display-sm text-text">Gather</span>
          <p className="text-body text-text-2">
            Sign in with the Google account tied to your scheduling app.
          </p>
          <SignInButton />
        </div>
        <p className="text-body-sm text-text-2">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-text">
            Privacy
          </Link>
          <span className="px-2 text-text-3">·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-text">
            Terms
          </Link>
          <span className="px-2 text-text-3">·</span>
          <a href="mailto:support@gathertime.com" className="underline underline-offset-2 hover:text-text">
            support@gathertime.com
          </a>
        </p>
        {adminLoginEnabled && (
          <div className="flex w-full max-w-xs flex-col items-center gap-3 border-t border-hairline pt-6">
            <p className="text-center text-body-sm text-rose">
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
  const isCollaboratorOnly = !!(session as any).isCollaboratorOnly;
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
      isCollaboratorOnly={isCollaboratorOnly}
      initialCalendarId={initialCalendarId}
    >
      {children}
    </DashboardChrome>
  );
}
