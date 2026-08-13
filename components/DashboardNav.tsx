'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

const LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/schedule', label: 'Schedule' },
  { href: '/dashboard/rules', label: 'Rules' },
  { href: '/dashboard/reasons', label: 'Reasons' },
  { href: '/dashboard/errors', label: 'Errors' },
  { href: '/dashboard/export', label: 'Export' },
];

export default function DashboardNav({ email }: { email?: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-row overflow-x-auto border-b border-border bg-surface md:w-56 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
      <div className="hidden flex-col gap-1 px-4 py-4 md:flex">
        <span className="font-serif text-lg font-semibold text-text-primary">Gather</span>
        <span className="truncate text-xs text-text-secondary">{email}</span>
      </div>
      <ul className="flex flex-row md:flex-col">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className="flex-1 md:flex-none">
              <Link
                href={link.href}
                className={`block whitespace-nowrap px-4 py-3 text-sm font-medium ${
                  active ? 'bg-accent-soft/30 text-text-primary' : 'text-text-secondary hover:bg-accent-soft/15'
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden px-4 py-4 md:block">
        <SignOutButton />
      </div>
    </nav>
  );
}
