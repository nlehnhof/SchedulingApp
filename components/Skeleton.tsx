/**
 * Shape-of-content loading placeholder, for spots where a bare spinner reads
 * as more jarring than a soft pulse in the layout that's about to appear
 * (e.g. a card or list row about to be filled by an SWR response).
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-border/60 ${className}`} />;
}
