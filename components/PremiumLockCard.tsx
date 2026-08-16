/**
 * "Upgrade to Premium" empty state — was duplicated near-verbatim across
 * Branding, Reminders, and Analytics before this extraction.
 */
export default function PremiumLockCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="font-serif text-xl font-semibold text-text-primary">{title}</h1>
      <div className="rounded-2xl border border-accent-soft bg-accent-soft/15 p-6 shadow-soft">
        <p className="text-sm font-medium text-text-primary">This is a premium feature.</p>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  );
}
