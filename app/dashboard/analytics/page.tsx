'use client';

import type { ReactNode } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

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
  const { data, error, isLoading } = useSWR<AnalyticsData>('/api/client/analytics', fetcher);

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;

  if (error) {
    // The API 403s free-tier clients (defense-in-depth even though the nav
    // already routes everyone here so the locked state has somewhere to
    // live — PLAN.md Section 4 feature 4). fetcher()'s thrown Error embeds
    // the status code in its message; this is presentation-only logic, the
    // real gate already happened server-side.
    const locked = /\(403\)/.test(String(error.message));
    if (locked) {
      return (
        <div className="flex max-w-xl flex-col gap-4">
          <h1 className="font-serif text-xl font-semibold text-text-primary">Analytics</h1>
          <div className="rounded-lg border border-accent-soft bg-accent-soft/15 p-6">
            <p className="text-sm font-medium text-text-primary">This is a premium feature.</p>
            <p className="mt-1 text-sm text-text-secondary">
              Upgrade to Premium to see booking volume trends, busiest days/hours, appointment
              status breakdown, and which reasons visitors book most.
            </p>
          </div>
        </div>
      );
    }
    return <p className="text-sm text-danger">Failed to load analytics.</p>;
  }
  if (!data) return null;

  const maxWeek = Math.max(1, ...data.volumeByWeek.map((w) => w.count));
  const maxDay = Math.max(1, ...data.byDayOfWeek.map((d) => d.count));
  const maxHour = Math.max(1, ...data.byHour.map((h) => h.count));
  const maxReason = Math.max(1, ...data.reasonPopularity.map((r) => r.count));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary">
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
            <li className="text-text-secondary">No appointments in this window.</li>
          )}
        </ul>
      </Section>

      <Section title="Most-booked reasons">
        <ul className="flex flex-col gap-2 text-sm">
          {data.reasonPopularity.map((r) => (
            <li key={r.reason} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate">{r.reason}</span>
              <div className="h-2 flex-1 rounded-full bg-border">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.count / maxReason) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-text-secondary">{r.count}</span>
            </li>
          ))}
          {data.reasonPopularity.length === 0 && (
            <li className="text-text-secondary">No appointments in this window.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">{title}</h2>
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
  if (items.length === 0) return <p className="text-sm text-text-secondary">No data yet.</p>;
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-2">
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex flex-col items-center gap-1">
          <div
            className="w-4 rounded-t bg-accent"
            style={{ height: `${Math.max(2, (item.value / max) * 80)}px` }}
            title={`${item.label}: ${item.value}`}
          />
          {!compact && <span className="text-[10px] text-text-secondary">{item.label}</span>}
        </div>
      ))}
    </div>
  );
}
