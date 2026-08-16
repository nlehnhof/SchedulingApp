'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import AppointmentCard from '@/components/AppointmentCard';
import { isAtLeast, type Tier } from '@/lib/tier';
import { useCalendar } from '@/components/CalendarContext';
import type { Appointment, ErrorLogEntry, Rule } from '@/lib/types';

interface DashboardResponse {
  appointments: Appointment[];
  rules: Rule[];
  errors: ErrorLogEntry[];
  calendar: { id: string; displayName: string | null; slug: string | null; tier: Tier } | null;
  hasReasons: boolean;
  reasons: { id: string; name: string }[];
  stats: {
    total: number;
    this_month: number;
    next_booked: Appointment | null;
    pending_errors: number;
  };
}

const QUICK_ACTIONS = [
  { href: '/dashboard/schedule', label: 'View Schedule' },
  { href: '/dashboard/rules', label: 'Create Rule' },
  { href: '/dashboard/export', label: 'Export' },
];

export default function DashboardHome() {
  const { calendarId } = useCalendar();
  const { data, error, isLoading } = useSWR<DashboardResponse>(
    calendarId ? `/api/client/dashboard?calendarId=${calendarId}` : null,
    fetcher
  );

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error) return <p className="text-sm text-danger">Failed to load dashboard: {String(error.message)}</p>;
  if (!data) return null;

  const now = new Date();
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const upcoming = data.appointments.filter((a) => {
    const start = new Date(a.start_time);
    return start >= now && start <= in7Days;
  });

  const hasRules = data.rules.length > 0;
  const reasonNameById = new Map(data.reasons.map((r) => [r.id, r.name]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Dashboard</h1>

      {/* Previously there was no way to find your own visitor booking link
          from the UI at all — it was only ever printed to the console by
          scripts/seed.js (PLAN.md Section 1/2 item 1, the single
          highest-value fix identified). */}
      {data.calendar && <BookingLinkCard calendar={data.calendar} />}
      {data.calendar && !isAtLeast(data.calendar.tier, 'premium') && <PremiumFeaturesCard />}

      {(!data.hasReasons || !hasRules) && (
        <div className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent-soft/25 p-4 text-sm">
          {!data.hasReasons && (
            <p>
              <Link href="/dashboard/reasons" className="font-medium text-accent-hover hover:underline">
                Add your first appointment reason
              </Link>{' '}
              so visitors have something to book.
            </p>
          )}
          {!hasRules && (
            <p>
              <Link href="/dashboard/rules" className="font-medium text-accent-hover hover:underline">
                Add your first availability rule
              </Link>{' '}
              so visitors can actually book you.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Appointments this month" value={data.stats.this_month} />
        <StatCard
          label="Next booked"
          value={
            data.stats.next_booked
              ? new Date(data.stats.next_booked.start_time).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'
          }
        />
        <StatCard label="Pending errors" value={data.stats.pending_errors} warn={data.stats.pending_errors > 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent-soft/15"
          >
            {action.label}
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Upcoming (next 7 days)
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-secondary">Nothing booked in the next 7 days.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} reasonName={reasonNameById.get(apt.reason_id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingLinkCard({
  calendar,
}: {
  calendar: { id: string; displayName: string | null; slug: string | null; tier: Tier };
}) {
  const [copied, setCopied] = useState(false);
  const path = isAtLeast(calendar.tier, 'premium') && calendar.slug ? calendar.slug : calendar.id;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/visit/${path}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-HTTPS context); the link
      // text is already selectable/visible as a fallback.
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-text-secondary">Your booking link</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-background px-2 py-1 text-sm text-text-primary">{link}</code>
        <button
          onClick={copyLink}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent-soft/15"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        Share this with visitors — anyone with this link can book an appointment with you.
        {!isAtLeast(calendar.tier, 'premium') && (
          <>
            {' '}
            <Link href="/dashboard/billing" className="text-accent-hover hover:underline">
              Upgrade to premium
            </Link>{' '}
            for a short, custom link instead of this long id.
          </>
        )}
      </p>
    </div>
  );
}

const PREMIUM_FEATURES = [
  {
    title: 'Custom branding',
    description: 'Your business name, accent color, and logo on your booking page instead of the default look.',
    href: '/dashboard/branding',
  },
  {
    title: 'Custom booking link',
    description: 'A short, memorable link like /visit/dr-smith instead of a long id.',
    href: '/dashboard/branding',
  },
  {
    title: 'Analytics dashboard',
    description: 'Booking volume, busiest days/hours, and which reasons visitors book most.',
    href: '/dashboard/analytics',
  },
  {
    title: 'Booking confirmation emails',
    description: 'Every visitor gets an automatic confirmation under your business name — no setup needed.',
    href: '/dashboard/reminders',
  },
  {
    title: 'Text message reminders',
    description: 'Automatic text reminders before each appointment, to cut down on no-shows.',
    href: '/dashboard/reminders',
  },
];

// Free-tier clients otherwise only discover premium features one at a time,
// by clicking into Branding or Analytics and hitting a locked panel — this
// gives a single place to see and understand all four before deciding to
// upgrade, without granting any access (every link still lands on a
// locked/upsell view for a free client; nothing here is a shortcut around
// the server-side tier check).
function PremiumFeaturesCard() {
  return (
    <div className="rounded-lg border border-accent-soft bg-accent-soft/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-text-secondary">Premium features</div>
        <Link href="/dashboard/billing" className="text-xs font-medium text-accent-hover hover:underline">
          Upgrade to premium
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f.title}>
            <Link href={f.href} className="block rounded-md border border-border bg-surface p-3 hover:bg-accent-soft/15">
              <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <span aria-hidden="true">🔒</span>
                {f.title}
              </div>
              <p className="mt-1 text-xs text-text-secondary">{f.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-text-secondary">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${warn ? 'text-danger' : ''}`}>{value}</div>
    </div>
  );
}
