'use client';

import { useState } from 'react';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { postJSON } from '@/lib/fetcher';
import { useCalendar } from '@/components/CalendarContext';

function lastNMonths(n: number): { value: string; label: string }[] {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

export default function ExportPage() {
  const { calendarId } = useCalendar();
  const months = lastNMonths(12);
  const [month, setMonth] = useState(months[0].value);
  const [status, setStatus] = useState<'idle' | 'queued' | 'error'>('idle');
  const [message, setMessage] = useState('');
  // Confirm-then-send + a `sending` guard: previously one click fired an
  // email immediately with no disabled state, so a double-click sent two
  // real emails via Resend (PLAN.md Section 1/2 item 6).
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleExport() {
    if (sending || !calendarId) return;
    setSending(true);
    setStatus('idle');
    try {
      await postJSON(`/api/client/export?calendarId=${calendarId}`, { month });
      setStatus('queued');
      setMessage(`Sent to your account email for ${month}.`);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message ?? 'Export failed.');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Export</h1>
      <Select
        label="Month"
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          setConfirming(false);
        }}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>

      {!confirming ? (
        <Button onClick={() => setConfirming(true)} disabled={sending}>
          Export this month
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent-soft/25 p-3 text-sm">
          <p>This will email a CSV of {month}&apos;s appointments to your account email — continue?</p>
          <div className="flex gap-2">
            <Button onClick={handleExport} disabled={sending}>
              {sending ? 'Sending…' : 'Yes, send it'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === 'queued' && <p className="text-sm text-success">Sent — {message}</p>}
      {status === 'error' && <p className="text-sm text-danger">{message}</p>}
    </div>
  );
}
