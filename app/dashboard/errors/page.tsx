'use client';

import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { ErrorLogEntry } from '@/lib/types';
import ErrorBanner from '@/components/ErrorBanner';

const KEY = '/api/client/errors';

export default function ErrorsPage() {
  // Auto-refresh every 5 min per Phase 3 spec.
  const { data, error, isLoading } = useSWR<{ errors: ErrorLogEntry[] }>(KEY, fetcher, {
    refreshInterval: 5 * 60 * 1000,
  });

  async function acknowledge(id: string) {
    await postJSON(`/api/client/errors/${id}/acknowledge`, {});
    mutate(KEY);
  }

  async function retrySync() {
    await postJSON('/api/client/errors/retry-sync', {});
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
          <ErrorBanner key={e.id} error={e} onAcknowledge={acknowledge} onRetry={retrySync} />
        ))}
      </div>
    </div>
  );
}
