'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import AppointmentCard from '@/components/AppointmentCard';
import type { Appointment, ErrorLogEntry, Rule } from '@/lib/types';

interface DashboardResponse {
  appointments: Appointment[];
  rules: Rule[];
  errors: ErrorLogEntry[];
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
  const { data, error, isLoading } = useSWR<DashboardResponse>('/api/client/dashboard', fetcher);

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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Dashboard</h1>

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
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        )}
      </div>
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
