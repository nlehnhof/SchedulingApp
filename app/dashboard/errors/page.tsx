'use client';

import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { ErrorLogEntry } from '@/lib/types';
import ErrorBanner from '@/components/ErrorBanner';
import Spinner from '@/components/Spinner';
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
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-xl font-semibold text-text">Error Log</h1>
      {isLoading && <Spinner />}
      {error && <p className="text-sm text-rose">Failed to load error log.</p>}
      {errors.length === 0 && !isLoading && (
        <p className="text-sm text-text-2">No errors. Everything&apos;s syncing cleanly.</p>
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
