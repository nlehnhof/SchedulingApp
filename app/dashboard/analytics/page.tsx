'use client';

import type { ReactNode } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useCalendar } from '@/components/CalendarContext';
import PremiumLockCard from '@/components/PremiumLockCard';
import Spinner from '@/components/Spinner';

interface AnalyticsData {
  windowDays: number;
  total: number;
  volumeByWeek: { week: string; count: number }[];
  byDayOfWeek: { day: string; count: number }[];
  byHour: { hour: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  reasonPopularity: { reason: string; count: number }[];
}

export default function AnalyticsPage() {
  const { calendarId } = useCalendar();
  const { data, error, isLoading } = useSWR<AnalyticsData>(
    calendarId ? `/api/client/analytics?calendarId=${calendarId}` : null,
    fetcher
  );

  if (isLoading) return <Spinner />;

  if (error) {
    // The API 403s free-tier clients (defense-in-depth even though the nav
    // already routes everyone here so the locked state has somewhere to
    // live — PLAN.md Section 4 feature 4). fetcher()'s thrown Error embeds
    // the status code in its message; this is presentation-only logic, the
    // real gate already happened server-side.
    const locked = /\(403\)/.test(String(error.message));
    if (locked) {
      return (
        <PremiumLockCard
          title="Analytics"
          description="Upgrade to Premium to see booking volume trends, busiest days/hours, appointment status breakdown, and which reasons visitors book most."
        />
      );
    }
    return <p className="text-sm text-rose">Failed to load analytics.</p>;
  }
  if (!data) return null;

  const maxWeek = Math.max(1, ...data.volumeByWeek.map((w) => w.count));
  const maxDay = Math.max(1, ...data.byDayOfWeek.map((d) => d.count));
  const maxHour = Math.max(1, ...data.byHour.map((h) => h.count));
  const maxReason = Math.max(1, ...data.reasonPopularity.map((r) => r.count));

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="font-display text-xl font-semibold text-text">Analytics</h1>
        <p className="text-sm text-text-2">
          Last {data.windowDays} days · {data.total} appointments
        </p>
      </div>

      <Section title="Booking volume by week">
        <BarRow items={data.volumeByWeek.map((w) => ({ label: w.week.slice(5), value: w.count }))} max={maxWeek} />
      </Section>

      <Section title="Busiest days">
        <BarRow items={data.byDayOfWeek.map((d) => ({ label: d.day, value: d.count }))} max={maxDay} />
      </Section>

      <Section title="Busiest hours">
        <BarRow
          items={data.byHour.map((h) => ({ label: String(h.hour), value: h.count }))}
          max={maxHour}
          compact
        />
      </Section>

      <Section title="Appointment status">
        <ul className="flex flex-col gap-1 text-sm">
          {data.statusBreakdown.map((s) => (
            <li key={s.status} className="flex justify-between">
              <span className="capitalize">{s.status.replace('_', ' ')}</span>
              <span className="font-medium">{s.count}</span>
            </li>
          ))}
          {data.statusBreakdown.length === 0 && (
            <li className="text-text-2">No appointments in this window.</li>
          )}
        </ul>
      </Section>

      <Section title="Most-booked reasons">
        <ul className="flex flex-col gap-3 text-sm">
          {data.reasonPopularity.map((r) => (
            <li key={r.reason} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="sm:w-32 sm:shrink-0 sm:truncate">{r.reason}</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-full min-w-24 flex-1 rounded-full bg-hairline sm:w-auto">
                  <div
                    className="h-2 rounded-full bg-lume transition-all"
                    style={{ width: `${(r.count / maxReason) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-text-2">{r.count}</span>
              </div>
            </li>
          ))}
          {data.reasonPopularity.length === 0 && (
            <li className="text-text-2">No appointments in this window.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-2">{title}</h2>
      {children}
    </div>
  );
}

function BarRow({
  items,
  max,
  compact,
}: {
  items: { label: string; value: number }[];
  max: number;
  compact?: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-text-2">No data yet.</p>;
  return (
    <div className="relative">
      <div className="flex items-end gap-2 overflow-x-auto pb-2">
        {items.map((item, i) => (
          <div key={`${item.label}-${i}`} className="flex shrink-0 flex-col items-center gap-1">
            {/* Value shown as real text, not a `title` tooltip — those never
                fire on touch, which made this data invisible on mobile. */}
            <span className="text-[10px] font-medium text-text-2">{item.value}</span>
            <div
              className="w-5 rounded-t-md bg-lume transition-all hover:bg-lume-bright"
              style={{ height: `${Math.max(2, (item.value / max) * 80)}px` }}
            />
            {!compact && <span className="text-[10px] text-text-2">{item.label}</span>}
          </div>
        ))}
      </div>
      {/* Fades the right edge when the row overflows, as a visual hint that
          there's more to scroll to (the old version had no such affordance
          — data could silently scroll off-screen with nothing to suggest it). */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
