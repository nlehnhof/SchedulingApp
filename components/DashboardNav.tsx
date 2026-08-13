'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

interface NavLink {
  href: string;
  label: string;
  premium?: boolean;
}

// Grouped by the natural setup order rather than presented as one flat,
// arbitrarily-ordered list (PLAN.md Section 2 item 11): Setup happens
// first (Reasons, Rules), Operate is day-to-day use once bookings start
// coming in. Premium items always render (even for a free-tier client) —
// the pages themselves show a locked/upsell view when not premium, same
// pattern as the Branding/Analytics panels (PLAN.md Section 4).
const SETUP_LINKS: NavLink[] = [
  { href: '/dashboard/reasons', label: 'Reasons' },
  { href: '/dashboard/rules', label: 'Rules' },
];
const OPERATE_LINKS: NavLink[] = [
  { href: '/dashboard/schedule', label: 'Schedule' },
  { href: '/dashboard/errors', label: 'Errors' },
  { href: '/dashboard/export', label: 'Export' },
];
const PREMIUM_LINKS: NavLink[] = [
  { href: '/dashboard/branding', label: 'Branding', premium: true },
  { href: '/dashboard/analytics', label: 'Analytics', premium: true },
];

export default function DashboardNav({
  email,
  tier,
  onReplayTutorial,
}: {
  email?: string | null;
  tier?: 'free' | 'premium';
  onReplayTutorial?: () => void;
}) {
  const pathname = usePathname();
  const isPremium = tier === 'premium';

  function renderGroup(label: string, links: NavLink[]) {
    return (
      <li className="flex-1 md:flex-none">
        <div className="hidden px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-secondary/70 md:block">
          {label}
        </div>
        <ul className="flex flex-row md:flex-col">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href} className="flex-1 md:flex-none">
                <Link
                  href={link.href}
                  className={`flex items-center justify-between gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium ${
                    active
                      ? 'bg-accent-soft/30 text-text-primary'
                      : 'text-text-secondary hover:bg-accent-soft/15'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.premium && !isPremium && (
                    <span className="rounded-full bg-accent-soft/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-hover">
                      Premium
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <nav className="flex shrink-0 flex-row overflow-x-auto border-b border-border bg-surface md:w-56 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
      <div className="hidden flex-col gap-1 px-4 py-4 md:flex">
        <div className="flex items-center justify-between">
          <span className="font-serif text-lg font-semibold text-text-primary">Gather</span>
          {onReplayTutorial && (
            <button
              onClick={onReplayTutorial}
              aria-label="Replay tutorial"
              title="Replay tutorial"
              className="rounded-full border border-border px-1.5 text-xs text-text-secondary hover:bg-accent-soft/20"
            >
              ?
            </button>
          )}
        </div>
        <span className="truncate text-xs text-text-secondary">{email}</span>
      </div>
      <ul className="flex flex-row md:flex-col">
        <li className="flex-1 md:flex-none">
          <Link
            href="/dashboard"
            className={`block whitespace-nowrap px-4 py-3 text-sm font-medium ${
              pathname === '/dashboard'
                ? 'bg-accent-soft/30 text-text-primary'
                : 'text-text-secondary hover:bg-accent-soft/15'
            }`}
          >
            Home
          </Link>
        </li>
        {renderGroup('Setup', SETUP_LINKS)}
        {renderGroup('Operate', OPERATE_LINKS)}
        {renderGroup('Premium', PREMIUM_LINKS)}
      </ul>
      <div className="hidden px-4 py-4 md:block">
        <SignOutButton />
      </div>
    </nav>
  );
}
