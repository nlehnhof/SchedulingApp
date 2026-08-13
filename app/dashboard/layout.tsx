import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import DashboardNav from '@/components/DashboardNav';
import SignInButton from '@/components/SignInButton';
import AdminLoginForm from '@/components/AdminLoginForm';

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

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardNav email={session.user?.email} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
