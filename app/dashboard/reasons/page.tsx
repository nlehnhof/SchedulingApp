'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { AppointmentReason } from '@/lib/types';
import Button from '@/components/Button';
import Input from '@/components/Input';

export default function ReasonsPage() {
  const { data, error, isLoading } = useSWR<{ reasons: AppointmentReason[] }>(
    '/api/client/reasons',
    fetcher
  );
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('15');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reasons = data?.reasons ?? [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSaving(true);
    try {
      await postJSON('/api/client/reasons', {
        name,
        durationMin: Number(duration),
        order: reasons.length,
      });
      setName('');
      setDuration('15');
      mutate('/api/client/reasons');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to save reason');
    } finally {
      setSaving(false);
    }
  }

  async function handleDurationChange(reason: AppointmentReason, durationMin: number) {
    await postJSON('/api/client/reasons', {
      name: reason.name,
      durationMin,
      order: reason.order,
    });
    mutate('/api/client/reasons');
  }

  async function moveReason(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= reasons.length) return;
    const a = reasons[index];
    const b = reasons[target];
    await Promise.all([
      postJSON('/api/client/reasons', { name: a.name, durationMin: a.duration_min, order: b.order }),
      postJSON('/api/client/reasons', { name: b.name, durationMin: b.duration_min, order: a.order }),
    ]);
    mutate('/api/client/reasons');
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Appointment Reasons</h1>

      {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Failed to load reasons.</p>}

      <ul className="flex flex-col gap-2">
        {reasons.map((reason, i) => (
          <li
            key={reason.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{reason.name}</span>
              <span className="text-xs text-text-secondary">
                <input
                  type="number"
                  min={1}
                  defaultValue={reason.duration_min}
                  className="w-16 rounded border border-border px-1 py-0.5 text-xs"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v && v !== reason.duration_min) handleDurationChange(reason, v);
                  }}
                />{' '}
                min
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => moveReason(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="rounded px-2 py-1 text-text-secondary hover:bg-accent-soft/20 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveReason(i, 1)}
                disabled={i === reasons.length - 1}
                aria-label="Move down"
                className="rounded px-2 py-1 text-text-secondary hover:bg-accent-soft/20 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex items-end gap-2 border-t border-border pt-4">
        <Input label="New reason" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Duration (min)"
          type="number"
          min={1}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-28"
          required
        />
        <Button type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
    </div>
  );
}
