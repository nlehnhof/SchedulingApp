'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
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

  if (isLoading) return <Spinner />;
  if (error || !data) return <p className="text-body-sm text-rose">Failed to load your team.</p>;

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-display-md text-text">Team</h1>
        <p className="mt-1 text-body-sm text-text-2">
          Give other people access to <span className="font-medium">{calendarName}</span> without
          sharing your Google login. Viewers can look but not touch. Editors can manage rules,
          reasons, and appointments. Billing and team access always stay owner-only.
        </p>
      </div>

      {actionError && <p className="text-body-sm text-rose">{actionError}</p>}

      <ul className="flex flex-col gap-3">
        {collaborators.map((c) => (
          <li key={c.id}>
            <Card hoverable padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col">
                <span className="text-body font-medium text-text">{c.email}</span>
                <span className="text-body-sm text-text-2">
                  {c.accepted_at
                    ? `Accepted ${new Date(c.accepted_at).toLocaleDateString()}`
                    : `Invited ${new Date(c.invited_at).toLocaleDateString()}, pending`}
                </span>
              </div>

              {confirmRevokeId === c.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm text-rose">Revoke access?</span>
                  <Button variant="danger" onClick={() => handleRevoke(c.id)}>
                    Confirm
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRevokeId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={c.role}
                    onChange={(e) => handleRoleChange(c.id, e.target.value as 'viewer' | 'editor')}
                    className="text-body-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmRevokeId(c.id)}
                    className="text-rose hover:bg-rose/10"
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
        {collaborators.length === 0 && (
          <p className="text-body-sm text-text-2">Nobody has access yet. Invite someone below.</p>
        )}
      </ul>

      <Card padding="sm">
        <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
      </Card>
      {inviteError && <p className="text-body-sm text-rose">{inviteError}</p>}
    </div>
  );
}
