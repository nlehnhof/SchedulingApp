'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { useCalendar } from '@/components/CalendarContext';

interface Collaborator {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  invited_at: string;
  accepted_at: string | null;
}

// Elite feature: shared dashboard access for other emails, without sharing
// the owner's own Google login (see app/api/client/team/route.ts and
// gather-elite-proposal.md's Feature 2). Scoped to the currently-selected
// calendar — a collaborator's role can vary by calendar, so there's no
// single account-wide team list.
export default function TeamPage() {
  const { calendarId, calendars } = useCalendar();
  const KEY = calendarId ? `/api/client/team?calendarId=${calendarId}` : null;
  const { data, error, isLoading } = useSWR<{ collaborators: Collaborator[] }>(KEY, fetcher);

  const calendarName = calendars.find((c) => c.id === calendarId)?.display_name || 'this calendar';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Failed to load your team.</p>;

  const collaborators = data.collaborators;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!calendarId) return;
    setInviteError(null);
    setInviting(true);
    try {
      await postJSON(`/api/client/team?calendarId=${calendarId}`, { email, role });
      setEmail('');
      mutate(KEY);
    } catch (err: any) {
      setInviteError(err.message ?? 'Could not send invite.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, newRole: 'viewer' | 'editor') {
    if (!calendarId) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/client/team/${id}?calendarId=${calendarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to update role');
      mutate(KEY);
    } catch (err: any) {
      setActionError(err.message ?? 'Could not update role.');
    }
  }

  async function handleRevoke(id: string) {
    if (!calendarId) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/client/team/${id}?calendarId=${calendarId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to revoke');
      mutate(KEY);
    } catch (err: any) {
      setActionError(err.message ?? 'Could not revoke access.');
    } finally {
      setConfirmRevokeId(null);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text-primary">Team</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Give other people access to <span className="font-medium">{calendarName}</span> without
          sharing your Google login. Viewers can look but not touch; Editors can manage rules,
          reasons, and appointments — billing and team access always stay owner-only.
        </p>
      </div>

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      <ul className="flex flex-col gap-2">
        {collaborators.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium text-text-primary">{c.email}</span>
              <span className="text-xs text-text-secondary">
                {c.accepted_at
                  ? `Accepted ${new Date(c.accepted_at).toLocaleDateString()}`
                  : `Invited ${new Date(c.invited_at).toLocaleDateString()} — pending`}
              </span>
            </div>

            {confirmRevokeId === c.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">Revoke access?</span>
                <Button variant="danger" onClick={() => handleRevoke(c.id)} className="px-2 py-1 text-xs">
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmRevokeId(null)}
                  className="px-2 py-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={c.role}
                  onChange={(e) => handleRoleChange(c.id, e.target.value as 'viewer' | 'editor')}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  onClick={() => setConfirmRevokeId(c.id)}
                  className="rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Revoke
                </button>
              </div>
            )}
          </li>
        ))}
        {collaborators.length === 0 && (
          <p className="text-sm text-text-secondary">
            Nobody has access yet — invite someone below.
          </p>
        )}
      </ul>

      <form onSubmit={handleInvite} className="flex items-end gap-2 border-t border-border pt-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </Select>
        <Button type="submit" disabled={inviting}>
          {inviting ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
      {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
    </div>
  );
}
