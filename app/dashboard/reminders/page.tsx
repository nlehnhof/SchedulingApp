'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import PremiumLockCard from '@/components/PremiumLockCard';
import Spinner from '@/components/Spinner';
import { isAtLeast, type Tier } from '@/lib/tier';

interface RemindersData {
  id: string;
  tier: Tier;
}

const KEY = '/api/client/reminders';

// Confirmation emails are live; text reminders are not (L4 launch phase —
// lib/sms.ts's sendSms() throws unconditionally by design, there is no
// connected provider). This page used to offer a toggle that saved a
// preference for a feature that could never actually send anything —
// replaced with a plain "not available yet" statement rather than a form
// that looks like it does something. See app/api/client/reminders/route.ts.
export default function RemindersPage() {
  const { data, error, isLoading } = useSWR<RemindersData>(KEY, fetcher);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load reminder settings.</p>;

  if (!isAtLeast(data.tier, 'premium')) {
    return (
      <PremiumLockCard
        title="Reminders & Confirmations"
        description="Upgrade to Premium and every visitor automatically gets a booking confirmation email under your business name."
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-display-md text-text">Reminders &amp; Confirmations</h1>
        <p className="mt-1 text-body-sm text-text-2">
          How visitors hear from you before and right after they book.
        </p>
      </div>

      <section className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-body font-medium text-text">Booking confirmation emails</h2>
          <span className="shrink-0 rounded-full bg-jade/14 px-2 py-0.5 text-micro font-semibold uppercase text-jade">
            Active
          </span>
        </div>
        <p className="mt-2 text-body-sm text-text-2">
          Every visitor who books gets an immediate confirmation email, sent under your business
          name, with any reply routed straight to your inbox. This is included automatically with
          Premium; there&apos;s nothing to turn on or configure.
        </p>
        <p className="mt-2 text-body-sm text-text-2">
          If a confirmation email ever fails to send, the booking itself still goes through. The
          failure is logged to your{' '}
          <Link href="/dashboard/errors" className="text-lume-bright hover:underline">
            Error Log
          </Link>{' '}
          so nothing gets missed silently.
        </p>
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-body font-medium text-text">Text message reminders</h2>
          <span className="shrink-0 rounded-full bg-text-2/12 px-2 py-0.5 text-micro font-semibold uppercase text-text-2">
            Not available yet
          </span>
        </div>
        <p className="mt-2 text-body-sm text-text-2">
          Text reminders aren&apos;t available in Gather yet. Nothing on this page needs to be
          turned on or saved, and no messages will send.
        </p>
      </section>
    </div>
  );
}
