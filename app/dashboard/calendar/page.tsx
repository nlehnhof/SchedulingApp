'use client';

import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import Button from '@/components/Button';
import Select from '@/components/Select';

interface CalendarData {
  linked: boolean;
  calendars: { id: string; summary: string; primary: boolean }[];
  selected: string;
}

const KEY = '/api/client/calendar';

export default function CalendarPage() {
  const { data, error, isLoading } = useSWR<CalendarData>(KEY, fetcher);

  const [calendarId, setCalendarId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCalendarId(data.selected);
  }, [data]);

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Failed to load calendar settings.</p>;

  if (!data.linked) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="font-serif text-xl font-semibold text-text-primary">Calendar</h1>
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="text-sm font-medium text-text-primary">No Google account connected.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in with Google to link a calendar — Gather uses it to check for conflicts before
            confirming a booking. (The admin test login doesn&apos;t connect a real calendar.)
          </p>
        </div>
      </div>
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
        body: JSON.stringify({ calendarId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ? JSON.stringify(json.error) : `Failed to save (${res.status})`);
      }
      setSaved(true);
      mutate(KEY);
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save calendar selection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Calendar</h1>
      <p className="text-sm text-text-secondary">
        Gather polls this calendar every 30 minutes for busy blocks and flags any booked
        appointment that conflicts with one.
      </p>

      <Select
        label="Google calendar to read"
        value={calendarId}
        onChange={(e) => setCalendarId(e.target.value)}
      >
        {data.calendars.map((cal) => (
          <option key={cal.id} value={cal.id}>
            {cal.summary}
            {cal.primary ? ' (primary)' : ''}
          </option>
        ))}
      </Select>

      {saveError && <p className="text-sm text-danger">{saveError}</p>}
      {saved && <p className="text-sm text-success">Calendar selection saved.</p>}
      <Button type="submit" disabled={saving || !calendarId}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
