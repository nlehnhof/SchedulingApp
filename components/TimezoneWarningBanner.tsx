'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useCalendar } from './CalendarContext';
import { detectBrowserTimezone } from '@/lib/timezone-options';

/**
 * Backstop for accounts that predate onboarding's mandatory time zone step
 * (L3 launch phase) — a calendar still defaulted to 'UTC' whose browser
 * reports something else means every Google write-back has been landing at
 * the wrong wall-clock hour. Dismissible for this view, but not persisted —
 * it comes back on the next load until the calendar's timezone is actually
 * fixed on /dashboard/calendar. Neutral/lume tone, not rose — this isn't an
 * active error, just a nudge (mirrors ErrorBanner's shape, different tone).
 */
export default function TimezoneWarningBanner() {
  const { calendarId, role } = useCalendar();
  const [dismissed, setDismissed] = useState(false);
  const KEY = calendarId ? `/api/client/calendar?calendarId=${calendarId}` : null;
  const { data } = useSWR<{ timezone: string }>(KEY, fetcher);

  if (dismissed || !data || role === 'viewer') return null;

  let browserZone: string | null = null;
  try {
    browserZone = detectBrowserTimezone();
  } catch {
    browserZone = null;
  }

  if (!browserZone || browserZone === 'UTC') return null;
  if (data.timezone !== 'UTC') return null;

  return (
    <div className="mx-4 mt-4 flex flex-col gap-2 rounded-md border border-lume/30 bg-lume/10 p-3 text-body-sm text-text sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
      <p>
        This calendar&apos;s time zone is still set to UTC, but your browser is in{' '}
        <span className="font-medium">{browserZone}</span>. Appointments will land on Google
        Calendar at the wrong hour until you set the right one.
      </p>
      <div className="flex shrink-0 gap-2">
        <a
          href="/dashboard/calendar"
          className="rounded-md border border-current px-2 py-1 text-body-sm"
        >
          Fix it
        </a>
        <button onClick={() => setDismissed(true)} className="rounded-md border border-current px-2 py-1 text-body-sm">
          Dismiss
        </button>
      </div>
    </div>
  );
}
