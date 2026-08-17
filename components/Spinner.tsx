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
    <div className={`flex items-center gap-2 text-body-sm text-text-2 ${className}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-lume" />
      <span>{label}</span>
    </div>
  );
}
