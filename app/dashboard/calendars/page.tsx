'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import { useCalendar, type CalendarSummary } from '@/components/CalendarContext';

const KEY = '/api/client/calendars';

// Elite feature: multiple independently-configured booking calendars per
// client account (hard-capped at 5 — see app/api/client/calendars/route.ts).
// This page manages the list; picking which one is "active" for every other
// dashboard page happens via the switcher in the nav (components/DashboardNav.tsx),
// both backed by the same CalendarContext.
export default function CalendarsPage() {
  const { data, error, isLoading } = useSWR<{ calendars: CalendarSummary[]; limit: number }>(
    KEY,
    fetcher
  );
  const { setCalendarId } = useCalendar();

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<CalendarSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-sm text-danger">Failed to load your calendars.</p>;

  // Owned calendars only — this page manages what an account owns.
  // Calendars shared with you as a collaborator show up in the switcher
  // (components/DashboardNav.tsx) but aren't listed/manageable here.
  const owned = data.calendars.filter((c) => c.role === 'owner');
  const atLimit = owned.length >= data.limit;

  async function handleCreate() {
    setCreateError(null);
    setCreating(true);
    try {
      const created = await postJSON<CalendarSummary>(KEY, {});
      await mutate(KEY);
      setCalendarId(created.id);
    } catch (err: any) {
      setCreateError(err.message ?? 'Could not create calendar.');
    } finally {
      setCreating(false);
    }
  }

  function openRename(cal: CalendarSummary) {
    setRenaming(cal);
    setRenameValue(cal.display_name ?? '');
    setRenameError(null);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setRenameError(null);
    try {
      const res = await fetch(`${KEY}/${renaming.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: renameValue.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed to rename (${res.status})`);
      setRenaming(null);
      mutate(KEY);
    } catch (err: any) {
      setRenameError(err.message ?? 'Could not rename calendar.');
    }
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`${KEY}/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed to delete (${res.status})`);
      setConfirmDeleteId(null);
      mutate(KEY);
    } catch (err: any) {
      setDeleteError(err.message ?? 'Could not delete calendar.');
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold text-text-primary">Calendars</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {owned.length} of {data.limit} used. Each calendar has its own rules,
            reasons, branding, booking link, and Google Calendar selection.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating || atLimit} className="shrink-0">
          {creating ? 'Creating…' : 'New calendar'}
        </Button>
      </div>

      {atLimit && data.limit === 1 && (
        <p className="rounded-md border border-accent/40 bg-accent-soft/25 p-3 text-sm text-text-primary">
          Upgrade to Elite to create more than one booking calendar.
        </p>
      )}
      {atLimit && data.limit > 1 && (
        <p className="rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">
          You&apos;ve reached the {data.limit}-calendar limit for your plan.
        </p>
      )}
      {createError && <p className="text-sm text-danger">{createError}</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {owned.map((cal) => (
          <li key={cal.id} className="animate-fade-up">
            <Card hoverable padding="sm" className="flex h-full flex-col justify-between gap-3 text-sm">
              <div className="flex flex-col">
                <span className="font-medium text-text-primary">
                  {cal.display_name || 'Untitled calendar'}
                </span>
                {cal.slug && <span className="text-xs text-text-secondary">/visit/{cal.slug}</span>}
              </div>

              {confirmDeleteId === cal.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-danger">Delete this calendar and everything on it?</span>
                  <Button variant="danger" onClick={() => handleDelete(cal.id)} className="px-2 py-1 text-xs">
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-1 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setCalendarId(cal.id)} className="px-2 py-1 text-xs">
                    Switch to
                  </Button>
                  <Button variant="ghost" onClick={() => openRename(cal)} className="px-2 py-1 text-xs">
                    Rename
                  </Button>
                  {owned.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDeleteId(cal.id)}
                      className="px-2 py-1 text-xs text-danger hover:bg-danger/10"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename calendar">
        <form onSubmit={handleRename} className="flex flex-col gap-4">
          <Input
            label="Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="e.g. Pastoral Counseling"
            autoFocus
          />
          {renameError && <p className="text-sm text-danger">{renameError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
