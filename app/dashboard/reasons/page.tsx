'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { AppointmentReason } from '@/lib/types';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import { useCalendar } from '@/components/CalendarContext';

const ICON_BUTTON = 'flex h-11 w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-accent-soft/20 disabled:opacity-30';

function ReasonExtras({
  reason,
  calendarId,
  reasonsKey,
  canWrite,
}: {
  reason: AppointmentReason;
  calendarId: string;
  reasonsKey: string;
  canWrite: boolean;
}) {
  const [infoNote, setInfoNote] = useState(reason.info_note ?? '');
  const [checkboxes, setCheckboxes] = useState<string[]>(reason.required_checkboxes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    infoNote !== (reason.info_note ?? '') ||
    JSON.stringify(checkboxes) !== JSON.stringify(reason.required_checkboxes ?? []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await patchReason(reason.id, calendarId, {
        infoNote,
        requiredCheckboxes: checkboxes.map((c) => c.trim()).filter(Boolean),
      });
      mutate(reasonsKey);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!canWrite && !reason.info_note && checkboxes.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
      {canWrite ? (
        <Input
          label="Instructions for visitors"
          value={infoNote}
          onChange={(e) => setInfoNote(e.target.value)}
          placeholder="e.g. Please bring your insurance card"
          maxLength={2000}
        />
      ) : (
        reason.info_note && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium">Note:</span> {reason.info_note}
          </p>
        )
      )}

      <div className="flex flex-col gap-1">
        {(canWrite || checkboxes.length > 0) && (
          <span className="text-xs font-medium text-text-primary">Required checkboxes</span>
        )}
        {checkboxes.map((label, i) =>
          canWrite ? (
            <div key={i} className="flex items-center gap-1">
              <input
                value={label}
                onChange={(e) =>
                  setCheckboxes((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))
                }
                className="w-full rounded border border-border px-1.5 py-0.5 text-xs"
              />
              <button
                onClick={() => setCheckboxes((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove checkbox ${i + 1}`}
                className="rounded px-1.5 py-0.5 text-xs text-danger hover:bg-danger/10"
              >
                ✕
              </button>
            </div>
          ) : (
            <span key={i} className="text-xs text-text-secondary">
              ☐ {label}
            </span>
          )
        )}
        {canWrite && (
          <button
            onClick={() => setCheckboxes((prev) => [...prev, ''])}
            className="w-fit rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-accent-soft/20"
          >
            + Add checkbox
          </button>
        )}
      </div>

      {canWrite && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={save}
            disabled={!dirty || saving || checkboxes.some((c) => !c.trim())}
            className="px-2 py-1 text-xs"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {error && <span className="text-xs text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Appointment Reasons</h1>

      {isLoading && <Spinner />}
      {error && <p className="text-sm text-danger">Failed to load reasons.</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reasons.map((reason, i) => (
          <li key={reason.id} className="animate-fade-up">
            <Card hoverable padding="sm" className="flex h-full flex-col gap-2 text-sm">
              <div className="flex items-start justify-between gap-3">
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
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveReason(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className={ICON_BUTTON}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveReason(i, 1)}
                      disabled={i === reasons.length - 1}
                      aria-label="Move down"
                      className={ICON_BUTTON}
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
                        className={`${ICON_BUTTON} text-danger hover:bg-danger/10`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
              {calendarId && KEY && (
                <ReasonExtras reason={reason} calendarId={calendarId} reasonsKey={KEY} canWrite={canWrite} />
              )}
            </Card>
          </li>
        ))}
        {reasons.length === 0 && !isLoading && (
          <p className="text-sm text-text-secondary">
            No reasons yet — add at least one below so visitors have something to book.
          </p>
        )}
      </ul>

      {canWrite && (
        <Card padding="sm">
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input label="New reason" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Duration (min)"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="sm:w-28"
              required
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </Card>
      )}
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
    </div>
  );
}
