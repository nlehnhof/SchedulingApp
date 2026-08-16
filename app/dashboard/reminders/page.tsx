'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import Button from '@/components/Button';
import PremiumLockCard from '@/components/PremiumLockCard';
import Spinner from '@/components/Spinner';
import { isAtLeast, type Tier } from '@/lib/tier';

interface RemindersData {
  id: string;
  tier: Tier;
  sms_reminders_enabled: boolean;
}

const KEY = '/api/client/reminders';

// Confirmation emails and SMS reminders share this one page because they're
// the same product idea from the client's point of view — "keep the visitor
// informed about their appointment" — even though only one of the two is
// actually wired to a live provider yet. sms_reminders_enabled is a
// client-level (not per-calendar) preference, unlike branding, which moved
// to booking_calendars — see app/api/client/reminders/route.ts.
export default function RemindersPage() {
  const { data, error, isLoading } = useSWR<RemindersData>(KEY, fetcher);

  const [smsRemindersEnabled, setSmsRemindersEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSmsRemindersEnabled(data.sms_reminders_enabled);
  }, [data]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-sm text-danger">Failed to load reminder settings.</p>;

  if (!isAtLeast(data.tier, 'premium')) {
    return (
      <PremiumLockCard
        title="Reminders & Confirmations"
        description="Upgrade to Premium and every visitor automatically gets a booking confirmation email under your business name — plus the option to send a text reminder before each appointment, to cut down on no-shows."
      />
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsRemindersEnabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ? JSON.stringify(json.error) : `Failed to save (${res.status})`);
      }
      setSaved(true);
      mutate(KEY);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save reminder settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text-primary">Reminders &amp; Confirmations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          How visitors hear from you before and right after they book.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Booking confirmation emails</h2>
          <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
            Active
          </span>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Every visitor who books gets an immediate confirmation email — sent under your business
          name, with any reply routed straight to your inbox. This is included automatically with
          Premium; there&apos;s nothing to turn on or configure.
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          If a confirmation email ever fails to send, the booking itself still goes through — the
          failure is logged to your{' '}
          <Link href="/dashboard/errors" className="text-accent-hover hover:underline">
            Error Log
          </Link>{' '}
          so nothing gets missed silently.
        </p>
      </section>

      <form
        onSubmit={handleSave}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Text message reminders</h2>
          <span className="shrink-0 rounded-full bg-text-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            Not yet live
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          Sends an automatic text reminder to the visitor roughly 24 hours before their
          appointment, to cut down on no-shows.
        </p>
        <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={smsRemindersEnabled}
            onChange={(e) => setSmsRemindersEnabled(e.target.checked)}
          />
          <span>
            Enable text reminders
            <span className="block text-xs text-text-secondary">
              Not yet live in this deployment — this saves your preference now so reminders start
              as soon as text sending is wired up, with no further action from you.
            </span>
          </span>
        </label>

        {saveError && <p className="text-sm text-danger">{saveError}</p>}
        {saved && <p className="text-sm text-success">Saved.</p>}
        <Button type="submit" disabled={saving} className="self-start">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
