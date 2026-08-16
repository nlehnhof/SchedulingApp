'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useCalendar } from '@/components/CalendarContext';

interface GoogleCalendarData {
  linked: boolean;
  calendars: { id: string; summary: string; primary: boolean }[];
  selected: string;
  timezone: string;
}

// A curated subset, not every IANA zone — Intl.supportedValuesOf('timeZone')
// would be exhaustive but overwhelming for a dropdown; the server accepts
// any valid IANA name regardless (lib/validation.ts's calendarSelectSchema
// validates via Intl.DateTimeFormat, not against this list).
const TIMEZONE_OPTIONS = [
  { id: 'Pacific/Honolulu', label: 'Hawaii' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'America/Los_Angeles', label: 'Pacific (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain (US & Canada)' },
  { id: 'America/Phoenix', label: 'Arizona (no DST)' },
  { id: 'America/Chicago', label: 'Central (US & Canada)' },
  { id: 'America/New_York', label: 'Eastern (US & Canada)' },
  { id: 'America/Puerto_Rico', label: 'Atlantic (Puerto Rico)' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris/Berlin/Madrid' },
  { id: 'UTC', label: 'UTC' },
];

export default function CalendarPage() {
  const { calendarId } = useCalendar();
  const KEY = calendarId ? `/api/client/calendar?calendarId=${calendarId}` : null;
  const { data, error, isLoading } = useSWR<GoogleCalendarData>(KEY, fetcher);

  // Google's own calendar id (an email address or opaque group-calendar
  // string) — deliberately named googleCalendarId, not calendarId, to keep
  // it visually distinct from the booking-calendar id from context above.
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGoogleCalendarId(data.selected);
    setTimezone(data.timezone);
  }, [data]);

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Failed to load calendar settings.</p>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!KEY) return;
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const body: Record<string, string> = { timezone };
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
    <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Calendar</h1>

      <div className="flex flex-col gap-1">
        <Select
          label="Time zone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
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
        <p className="text-xs text-text-secondary">
          Used to write appointments to Google Calendar at the correct time — set this to where
          this calendar&apos;s business actually operates, not where the server runs.
        </p>
      </div>

      {data.linked ? (
        <div className="flex flex-col gap-1">
          <Select
            label="Google calendar to read"
            value={googleCalendarId}
            onChange={(e) => setGoogleCalendarId(e.target.value)}
          >
            {data.calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.summary}
                {cal.primary ? ' (primary)' : ''}
              </option>
            ))}
          </Select>
          <p className="text-xs text-text-secondary">
            Gather polls this calendar every 30 minutes for busy blocks and flags any booked
            appointment that conflicts with one, and writes new bookings to it directly.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="text-sm font-medium text-text-primary">No Google account connected.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in with Google to link a calendar — Gather uses it to check for conflicts before
            confirming a booking, and writes bookings back to it. (The admin test login
            doesn&apos;t connect a real calendar.)
          </p>
        </div>
      )}

      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={saving || !timezone || (data.linked && !googleCalendarId)}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
