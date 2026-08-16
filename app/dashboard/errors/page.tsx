'use client';

import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { ErrorLogEntry } from '@/lib/types';
import ErrorBanner from '@/components/ErrorBanner';
import { useCalendar } from '@/components/CalendarContext';

export default function ErrorsPage() {
  const { calendarId, role } = useCalendar();
  const canWrite = role !== 'viewer';
  const KEY = calendarId ? `/api/client/errors?calendarId=${calendarId}` : null;
  // Auto-refresh every 5 min per Phase 3 spec.
  const { data, error, isLoading } = useSWR<{ errors: ErrorLogEntry[] }>(KEY, fetcher, {
    refreshInterval: 5 * 60 * 1000,
  });

  async function acknowledge(id: string) {
    if (!calendarId) return;
    await postJSON(`/api/client/errors/${id}/acknowledge?calendarId=${calendarId}`, {});
    mutate(KEY);
  }

  async function retrySync() {
    if (!calendarId) return;
    await postJSON('/api/client/errors/retry-sync', { calendarId });
    mutate(KEY);
  }

  const errors = data?.errors ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">Error Log</h1>
      {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Failed to load error log.</p>}
      {errors.length === 0 && !isLoading && (
        <p className="text-sm text-text-secondary">No errors. Everything&apos;s syncing cleanly.</p>
      )}
      <div className="flex flex-col gap-2">
        {errors.map((e) => (
          <ErrorBanner
            key={e.id}
            error={e}
            onAcknowledge={canWrite ? acknowledge : undefined}
            onRetry={canWrite ? retrySync : undefined}
          />
        ))}
      </div>
    </div>
  );
}
