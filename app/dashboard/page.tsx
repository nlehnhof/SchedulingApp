'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { Lock } from '@phosphor-icons/react';
import { fetcher } from '@/lib/fetcher';
import AppointmentCard from '@/components/AppointmentCard';
import Button from '@/components/Button';
import DayStrip, { DayStripBlock } from '@/components/DayStrip';
import { isAtLeast, type Tier } from '@/lib/tier';
import { useCalendar } from '@/components/CalendarContext';
import type { Appointment, ErrorLogEntry, Rule } from '@/lib/types';
import Spinner from '@/components/Spinner';
import everest from '@/public/everest.jpg';

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

  if (isLoading) return <Spinner />;
  if (error) return <p className="text-body-sm text-rose">Failed to load dashboard: {String(error.message)}</p>;
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

  const todayStr = now.toDateString();
  const todayBlocks: DayStripBlock[] = data.appointments
    .filter((a) => new Date(a.start_time).toDateString() === todayStr)
    .map((a) => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      return {
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: end.getHours() * 60 + end.getMinutes(),
        booked: true,
      };
    });

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <DashboardHeroBanner />

      {/* Previously there was no way to find your own visitor booking link
          from the UI at all — it was only ever printed to the console by
          scripts/seed.js (PLAN.md Section 1/2 item 1, the single
          highest-value fix identified). */}
      {data.calendar && <BookingLinkCard calendar={data.calendar} />}
      {data.calendar && !isAtLeast(data.calendar.tier, 'premium') && <PremiumFeaturesCard />}

      {(!data.hasReasons || !hasRules) && (
        <div className="flex flex-col gap-2 rounded-xl border border-lume/40 bg-lume/25 p-4 text-body-sm text-text">
          {!data.hasReasons && (
            <p>
              <Link href="/dashboard/reasons" className="font-medium text-lume-bright hover:underline">
                Add your first appointment reason
              </Link>{' '}
              so visitors have something to book.
            </p>
          )}
          {!hasRules && (
            <p>
              <Link href="/dashboard/rules" className="font-medium text-lume-bright hover:underline">
                Add your first availability rule
              </Link>{' '}
              so visitors can actually book you.
            </p>
          )}
        </div>
      )}

      <div className="flex divide-x divide-hairline">
        <Stat label="Appointments this month" value={data.stats.this_month} />
        <Stat
          label="Next booked"
          value={
            data.stats.next_booked
              ? new Date(data.stats.next_booked.start_time).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'None'
          }
        />
        <Stat label="Pending errors" value={data.stats.pending_errors} warn={data.stats.pending_errors > 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border border-edge px-3 py-2 text-body-sm hover:bg-lume/15"
          >
            {action.label}
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-label uppercase text-text-2">Today</h2>
        <DayStrip blocks={todayBlocks} />
      </div>

      <div>
        <h2 className="mb-3 text-label uppercase text-text-2">Upcoming (next 7 days)</h2>
        {upcoming.length === 0 ? (
          <p className="text-body-sm text-text-2">Nothing booked in the next 7 days.</p>
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

function DashboardHeroBanner() {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-hairline">
      <div className="absolute inset-0 motion-safe:animate-ken-burns">
        <Image
          src={everest}
          alt=""
          aria-hidden="true"
          fill
          placeholder="blur"
          className="object-cover contrast-[1.25] saturate-[1.1] brightness-[0.7]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/45 to-canvas/5" />
      {/* Same restrained highlight treatment as the marketing page's Summit
          section — amplifies the photo's own golden light, not a new
          decorative glow, and not the Lightline (DESIGN.md 1.1). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[10%] top-[0%] h-56 w-56 -translate-y-1/3 rounded-full bg-lume/50 mix-blend-screen blur-[90px] motion-safe:animate-bloom"
      />
      <div className="relative flex flex-col gap-1 px-6 py-10 sm:px-8 sm:py-14">
        <span className="text-label uppercase tracking-wide text-lume-bright">Gather</span>
        <h1 className="font-display text-display-md text-text sm:text-display-lg">Dashboard</h1>
        <p className="max-w-md text-body-sm text-text-2">
          The hours you open are the highest point anyone can book.
        </p>
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
    <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
      <div className="text-label uppercase text-text-2">Your booking link</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-canvas px-3 py-1.5 font-mono text-data text-text">{link}</code>
        <Button variant="secondary" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <p className="mt-2 text-body-sm text-text-2">
        Share this with visitors. Anyone with this link can book an appointment with you.
        {!isAtLeast(calendar.tier, 'premium') && (
          <>
            {' '}
            <Link href="/dashboard/billing" className="text-lume-bright hover:underline">
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
    description: 'Every visitor gets an automatic confirmation under your business name. No setup needed.',
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
    <div className="rounded-xl border border-lume/14 bg-lume/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-label uppercase text-text-2">Premium features</div>
        <Link href="/dashboard/billing" className="text-body-sm font-medium text-lume-bright hover:underline">
          Upgrade to premium
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f.title}>
            <Link href={f.href} className="block rounded-lg border border-edge bg-surface p-3 hover:bg-lume/15">
              <div className="flex items-center gap-1.5 text-body font-medium text-text">
                <Lock size={14} weight="regular" aria-hidden="true" />
                {f.title}
              </div>
              <p className="mt-1 text-body-sm text-text-2">{f.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="flex-1 px-4 first:pl-0">
      <div className={`font-mono text-data-xl ${warn ? 'text-rose' : 'text-text'}`}>{value}</div>
      <div className="mt-1 text-label text-text-2">{label}</div>
    </div>
  );
}
