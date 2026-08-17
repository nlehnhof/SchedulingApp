'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { AppointmentReason } from '@/lib/types';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Spinner from '@/components/Spinner';
import { useCalendar } from '@/components/CalendarContext';
import { X, Square, CaretUp, CaretDown } from '@phosphor-icons/react';

const ICON_BUTTON = 'flex h-11 w-11 items-center justify-center rounded-lg text-text-2 transition-colors hover:bg-lume/20 disabled:opacity-30';

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
    <div className="mt-3 flex flex-col gap-2">
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
          <p className="text-body-sm text-text-2">
            <span className="font-medium">Note:</span> {reason.info_note}
          </p>
        )
      )}

      <div className="flex flex-col gap-1">
        {(canWrite || checkboxes.length > 0) && (
          <span className="text-label text-text-2">Required checkboxes</span>
        )}
        {checkboxes.map((label, i) =>
          canWrite ? (
            <div key={i} className="flex items-center gap-1">
              <input
                value={label}
                onChange={(e) =>
                  setCheckboxes((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))
                }
                aria-label={`Checkbox label ${i + 1}`}
                className="w-full rounded-lg border border-edge px-1.5 py-0.5 text-body-sm text-text"
              />
              <button
                onClick={() => setCheckboxes((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove checkbox ${i + 1}`}
                className="rounded-lg px-1.5 py-0.5 text-body-sm text-rose hover:bg-rose/10"
              >
                <X size={12} weight="regular" />
              </button>
            </div>
          ) : (
            <span key={i} className="flex items-center gap-1 text-body-sm text-text-2">
              <Square size={12} weight="regular" aria-hidden="true" /> {label}
            </span>
          )
        )}
        {canWrite && (
          <button
            onClick={() => setCheckboxes((prev) => [...prev, ''])}
            className="w-fit rounded-lg px-1.5 py-0.5 text-body-sm text-text-2 hover:bg-lume/20"
          >
            + Add checkbox
          </button>
        )}
      </div>

      {canWrite && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={save} disabled={!dirty || saving || checkboxes.some((c) => !c.trim())}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {error && <span className="text-body-sm text-rose">{error}</span>}
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
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="font-display text-display-md text-text">Appointment Reasons</h1>

      {isLoading && <Spinner />}
      {error && <p className="text-body-sm text-rose">Failed to load reasons.</p>}
      {deleteError && <p className="text-body-sm text-rose">{deleteError}</p>}

      <ul className="flex flex-col divide-y divide-hairline">
        {reasons.map((reason, i) => (
          <li key={reason.id} className="flex flex-col gap-2 py-3 first:pt-0">
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
                      aria-label="Rename reason"
                      className="rounded-lg border border-edge px-1.5 py-0.5 text-body font-medium text-text"
                    />
                    <button
                      onClick={() => saveRename(reason)}
                      className="rounded-lg px-1.5 py-0.5 text-body-sm text-jade hover:bg-lume/20"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-1.5 py-0.5 text-body-sm text-text-2 hover:bg-lume/20"
                    >
                      Cancel
                    </button>
                  </div>
                ) : canWrite ? (
                  <button
                    onClick={() => startRename(reason)}
                    className="w-fit text-left text-body font-medium text-text hover:underline"
                    title="Click to rename"
                  >
                    {reason.name}
                  </button>
                ) : (
                  <span className="text-body font-medium text-text">{reason.name}</span>
                )}
                <span className="font-mono text-data-sm text-text-2">
                  {canWrite ? (
                    <input
                      type="number"
                      min={1}
                      defaultValue={reason.duration_min}
                      aria-label="Duration in minutes"
                      className="w-16 rounded-lg border border-edge px-1 py-0.5 font-mono text-data-sm text-text"
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
                    <CaretUp size={18} weight="regular" />
                  </button>
                  <button
                    onClick={() => moveReason(i, 1)}
                    disabled={i === reasons.length - 1}
                    aria-label="Move down"
                    className={ICON_BUTTON}
                  >
                    <CaretDown size={18} weight="regular" />
                  </button>
                  {confirmDeleteId === reason.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(reason.id)}
                        className="rounded-lg px-2 py-1 text-body-sm text-rose hover:bg-rose/10"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg px-2 py-1 text-body-sm text-text-2 hover:bg-lume/20"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(reason.id)}
                      aria-label={`Delete ${reason.name}`}
                      className={`${ICON_BUTTON} text-rose hover:bg-rose/10`}
                    >
                      <X size={18} weight="regular" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {calendarId && KEY && (
              <ReasonExtras reason={reason} calendarId={calendarId} reasonsKey={KEY} canWrite={canWrite} />
            )}
          </li>
        ))}
        {reasons.length === 0 && !isLoading && (
          <p className="text-body-sm text-text-2">
            No reasons yet. Add at least one below so visitors have something to book.
          </p>
        )}
      </ul>

      {canWrite && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-end"
        >
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
      )}
      {submitError && <p className="text-body-sm text-rose">{submitError}</p>}
    </div>
  );
}
