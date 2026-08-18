'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import Button from '@/components/Button';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import { useCalendar } from '@/components/CalendarContext';
import { TIMEZONE_OPTIONS } from '@/lib/timezone-options';

interface GoogleCalendarData {
  linked: boolean;
  calendars: { id: string; summary: string; primary: boolean }[];
  selected: string;
  timezone: string;
  allowVisitorManagement: boolean;
}

export default function CalendarPage() {
  const { calendarId, role } = useCalendar();
  const canWrite = role !== 'viewer';
  const KEY = calendarId ? `/api/client/calendar?calendarId=${calendarId}` : null;
  const { data, error, isLoading } = useSWR<GoogleCalendarData>(KEY, fetcher);

  // Google's own calendar id (an email address or opaque group-calendar
  // string) — deliberately named googleCalendarId, not calendarId, to keep
  // it visually distinct from the booking-calendar id from context above.
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [allowVisitorManagement, setAllowVisitorManagement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGoogleCalendarId(data.selected);
    setTimezone(data.timezone);
    setAllowVisitorManagement(data.allowVisitorManagement);
  }, [data]);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load calendar settings.</p>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!KEY) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { timezone, allowVisitorManagement };
      if (data!.linked) body.googleCalendarId = googleCalendarId;
      const res = await fetch(KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ? JSON.stringify(json.error) : `Failed to save (${res.status})`);
      }
      setSaved(true);
      mutate(KEY);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save calendar settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-display-md text-text">Calendar</h1>

      <div className="flex flex-col gap-1">
        <Select
          label="Time zone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={!canWrite}
        >
          {!TIMEZONE_OPTIONS.some((tz) => tz.id === timezone) && timezone && (
            <option value={timezone}>{timezone}</option>
          )}
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.id} value={tz.id}>
              {tz.label}
            </option>
          ))}
        </Select>
        <p className="text-body-sm text-text-2">
          Used to write appointments to Google Calendar at the correct time. Set this to where
          this calendar&apos;s business actually operates, not where the server runs.
        </p>
      </div>

      {data.linked ? (
        <div className="flex flex-col gap-1">
          <Select
            label="Google calendar to read"
            value={googleCalendarId}
            onChange={(e) => setGoogleCalendarId(e.target.value)}
            disabled={!canWrite}
          >
            {data.calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.summary}
                {cal.primary ? ' (primary)' : ''}
              </option>
            ))}
          </Select>
          <p className="text-body-sm text-text-2">
            Gather polls this calendar every 30 minutes for busy blocks and flags any booked
            appointment that conflicts with one, and writes new bookings to it directly.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface p-6">
          <p className="text-body font-medium text-text">No Google account connected.</p>
          <p className="mt-1 text-body-sm text-text-2">
            Sign in with Google to link a calendar. Gather uses it to check for conflicts before
            confirming a booking, and writes bookings back to it. (The admin test login
            doesn&apos;t connect a real calendar.)
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 rounded-lg border border-hairline p-3 text-body-sm text-text">
        <input
          type="checkbox"
          checked={allowVisitorManagement}
          onChange={(e) => setAllowVisitorManagement(e.target.checked)}
          disabled={!canWrite}
          className="accent-lume"
        />
        <span>
          Let visitors cancel or reschedule their own appointments
          <span className="block text-body-sm text-text-2">
            When off, the link in the confirmation email tells them to contact you directly
            instead.
          </span>
        </span>
      </label>

      {saveError && <p className="text-body-sm text-rose">{saveError}</p>}
      {saved && <p className="text-body-sm text-jade">Saved.</p>}
      {canWrite && (
        <Button type="submit" disabled={saving || !timezone || (data.linked && !googleCalendarId)}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    </form>
  );
}
