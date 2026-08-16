/**
 * Shared loading indicator — replaces the identical `<p>Loading…</p>` text
 * idiom repeated across every SWR-backed dashboard page.
 */
export default function Spinner({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-text-secondary ${className}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      <span>{label}</span>
    </div>
  );
}
