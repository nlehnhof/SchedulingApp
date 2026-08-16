import Link from 'next/link';
import { Lock } from '@phosphor-icons/react/ssr';
import Button from './Button';

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
      <h1 className="font-display text-display-md text-text">{title}</h1>
      <div className="flex flex-col gap-3 rounded-2xl border border-lume/14 bg-lume/10 p-6 shadow-lift1">
        <div className="flex items-center gap-2">
          <Lock size={18} weight="regular" className="text-lume" />
          <p className="text-body font-medium text-text">This is a premium feature</p>
        </div>
        <p className="text-body-sm text-text-2">{description}</p>
        <div>
          <Link href="/dashboard/billing">
            <Button variant="primary">Upgrade to premium</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
