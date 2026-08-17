/**
 * Shape-of-content loading placeholder, for spots where a bare spinner reads
 * as more jarring than a soft pulse in the layout that's about to appear
 * (e.g. a card or list row about to be filled by an SWR response).
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-lg bg-surface-2 bg-[length:200%_100%] bg-[linear-gradient(90deg,rgb(var(--surface-2-rgb))_25%,rgb(var(--hairline-rgb))_37%,rgb(var(--surface-2-rgb))_63%)] ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
