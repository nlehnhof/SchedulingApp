import type { ErrorLogEntry } from '@/lib/types';

export default function ErrorBanner({
  error,
  onAcknowledge,
  onRetry,
}: {
  error: ErrorLogEntry;
  onAcknowledge?: (id: string) => void;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        error.acknowledged
          ? 'border-border bg-background text-text-secondary'
          : 'border-danger/30 bg-danger/10 text-danger'
      }`}
    >
      <div>
        <div className="font-medium">{error.error_type}</div>
        <div>{error.message}</div>
        <div className="text-xs opacity-70">{new Date(error.created_at).toLocaleString()}</div>
      </div>
      <div className="flex gap-2">
        {onRetry && error.error_type.startsWith('google_sync') && (
          <button onClick={onRetry} className="rounded-md border border-current px-2 py-1 text-xs">
            Retry Sync
          </button>
        )}
        {onAcknowledge && !error.acknowledged && (
          <button
            onClick={() => onAcknowledge(error.id)}
            className="rounded-md border border-current px-2 py-1 text-xs"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
