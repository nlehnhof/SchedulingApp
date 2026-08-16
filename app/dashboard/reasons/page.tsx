'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { AppointmentReason } from '@/lib/types';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useCalendar } from '@/components/CalendarContext';

async function patchReason(id: string, calendarId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/client/reasons/${id}?calendarId=${calendarId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ? (typeof json.error === 'string' ? json.error : JSON.stringify(json.error)) : 'Request failed');
  }
  return json;
}

export default function ReasonsPage() {
  const { calendarId, role } = useCalendar();
  const canWrite = role !== 'viewer';
  const KEY = calendarId ? `/api/client/reasons?calendarId=${calendarId}` : null;
  const { data, error, isLoading } = useSWR<{ reasons: AppointmentReason[] }>(KEY, fetcher);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('15');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reasons = data?.reasons ?? [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!calendarId || !KEY) return;
    setSubmitError(null);
    setSaving(true);
    try {
      await postJSON(KEY, {
        name,
        durationMin: Number(duration),
        order: reasons.length,
      });
      setName('');
      setDuration('15');
      mutate(KEY);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to save reason');
    } finally {
      setSaving(false);
    }
  }

  async function handleDurationChange(reason: AppointmentReason, durationMin: number) {
    if (!calendarId) return;
    try {
      await patchReason(reason.id, calendarId, { durationMin });
      mutate(KEY);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to update duration');
    }
  }

  async function moveReason(index: number, delta: number) {
    if (!calendarId) return;
    const target = index + delta;
    if (target < 0 || target >= reasons.length) return;
    const a = reasons[index];
    const b = reasons[target];
    try {
      await Promise.all([
        patchReason(a.id, calendarId, { order: b.order }),
        patchReason(b.id, calendarId, { order: a.order }),
      ]);
      mutate(KEY);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to reorder');
    }
  }

  function startRename(reason: AppointmentReason) {
    setEditingId(reason.id);
    setEditingName(reason.name);
    setSubmitError(null);
  }

  async function saveRename(reason: AppointmentReason) {
    if (!calendarId) return;
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === reason.name) {
      setEditingId(null);
      return;
    }
    try {
      await patchReason(reason.id, calendarId, { name: trimmed });
      setEditingId(null);
      mutate(KEY);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to rename reason');
    }
  }

  async function handleDelete(id: string) {
    if (!calendarId) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/client/reasons/${id}?calendarId=${calendarId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Failed to delete reason');
      mutate(KEY);
    } catch (err: any) {
      setDeleteError(err.message ?? 'Failed to delete reason');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Appointment Reasons</h1>

      {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Failed to load reasons.</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      <ul className="flex flex-col gap-2">
        {reasons.map((reason, i) => (
          <li
            key={reason.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-col gap-1">
              {canWrite && editingId === reason.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename(reason);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="rounded border border-border px-1.5 py-0.5 text-sm font-medium"
                  />
                  <button
                    onClick={() => saveRename(reason)}
                    className="rounded px-1.5 py-0.5 text-xs text-success hover:bg-accent-soft/20"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-accent-soft/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : canWrite ? (
                <button
                  onClick={() => startRename(reason)}
                  className="w-fit text-left font-medium hover:underline"
                  title="Click to rename"
                >
                  {reason.name}
                </button>
              ) : (
                <span className="font-medium">{reason.name}</span>
              )}
              <span className="text-xs text-text-secondary">
                {canWrite ? (
                  <input
                    type="number"
                    min={1}
                    defaultValue={reason.duration_min}
                    className="w-16 rounded border border-border px-1 py-0.5 text-xs"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v && v !== reason.duration_min) handleDurationChange(reason, v);
                    }}
                  />
                ) : (
                  reason.duration_min
                )}{' '}
                min
              </span>
            </div>
            {canWrite && (
              <div className="flex items-center gap-1">
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
                {confirmDeleteId === reason.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(reason.id)}
                      className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-accent-soft/20"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(reason.id)}
                    aria-label={`Delete ${reason.name}`}
                    className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
        {reasons.length === 0 && !isLoading && (
          <p className="text-sm text-text-secondary">
            No reasons yet — add at least one below so visitors have something to book.
          </p>
        )}
      </ul>

      {canWrite && (
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
      )}
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
    </div>
  );
}
