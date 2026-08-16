'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import SignOutButton from './SignOutButton';
import Select from './Select';
import { useCalendar } from './CalendarContext';
import { postJSON } from '@/lib/fetcher';
import { isAtLeast, type Tier } from '@/lib/tier';

interface NavLink {
  href: string;
  label: string;
  minTier?: Tier; // undefined = available to every tier
}

// Grouped by the natural setup order rather than presented as one flat,
// arbitrarily-ordered list (PLAN.md Section 2 item 11): Setup happens
// first (Reasons, Rules), Operate is day-to-day use once bookings start
// coming in. Tier-gated items always render (even below the required
// tier) — the pages themselves show a locked/upsell view, same pattern as
// the Branding/Analytics panels (PLAN.md Section 4).
const SETUP_LINKS: NavLink[] = [
  { href: '/dashboard/reasons', label: 'Reasons' },
  { href: '/dashboard/rules', label: 'Rules' },
];
const OPERATE_LINKS: NavLink[] = [
  { href: '/dashboard/schedule', label: 'Schedule' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/errors', label: 'Errors' },
  { href: '/dashboard/export', label: 'Export' },
  { href: '/dashboard/billing', label: 'Billing' },
];
const PREMIUM_LINKS: NavLink[] = [
  { href: '/dashboard/branding', label: 'Branding', minTier: 'premium' },
  { href: '/dashboard/reminders', label: 'Reminders', minTier: 'premium' },
  { href: '/dashboard/analytics', label: 'Analytics', minTier: 'premium' },
];
const ELITE_LINKS: NavLink[] = [
  { href: '/dashboard/calendars', label: 'Calendars', minTier: 'elite' },
  { href: '/dashboard/team', label: 'Team', minTier: 'elite' },
];

// Dev tier-toggle cycles free -> premium -> elite -> free, rather than a
// boolean flip, now that there are three tiers to click through.
const NEXT_TIER: Record<Tier, Tier> = { free: 'premium', premium: 'elite', elite: 'free' };

export default function DashboardNav({
  email,
  tier,
  isAdminTestAccount,
  onReplayTutorial,
}: {
  email?: string | null;
  tier?: Tier;
  isAdminTestAccount?: boolean;
  onReplayTutorial?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentTier: Tier = tier ?? 'free';
  const [toggling, setToggling] = useState(false);
  const { calendarId, calendars, setCalendarId } = useCalendar();

  async function toggleTier() {
    setToggling(true);
    try {
      await postJSON('/api/client/dev-tier-toggle', {});
      // The session's tier is re-read fresh from the DB on every
      // getServerSession() call (lib/auth.ts), so re-rendering the server
      // layout is enough to pick up the new value — no sign-out/in needed.
      router.refresh();
    } catch {
      // Best-effort dev tool; silently no-op on failure (e.g. route 404s
      // if ALLOW_ADMIN_LOGIN was disabled between page load and click).
    } finally {
      setToggling(false);
    }
  }

  function renderGroup(label: string, links: NavLink[]) {
    return (
      <li className="flex-1 md:flex-none">
        <div className="hidden px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-secondary/70 md:block">
          {label}
        </div>
        <ul className="flex flex-row md:flex-col">
          {links.map((link) => {
            const active = pathname === link.href;
            const locked = !!link.minTier && !isAtLeast(currentTier, link.minTier);
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
                  {locked && (
                    <span className="rounded-full bg-accent-soft/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-hover">
                      {link.minTier}
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

        {/* Only shown once there's actually something to switch between —
            free/premium clients always have exactly 1 calendar, so this
            stays out of their way entirely. Grouped by role: a person can be
            both an owner and an accepted collaborator elsewhere (Elite team
            access, 0018 migration) and needs to tell those apart. */}
        {calendars.length > 1 && (
          <div className="mt-1">
            <Select
              label="Calendar"
              value={calendarId ?? ''}
              onChange={(e) => setCalendarId(e.target.value)}
              className="text-xs"
            >
              {calendars.some((c) => c.role === 'owner') && (
                <optgroup label="Your calendars">
                  {calendars
                    .filter((c) => c.role === 'owner')
                    .map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.display_name || 'Untitled calendar'}
                      </option>
                    ))}
                </optgroup>
              )}
              {calendars.some((c) => c.role !== 'owner') && (
                <optgroup label="Shared with you">
                  {calendars
                    .filter((c) => c.role !== 'owner')
                    .map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.display_name || 'Untitled calendar'} ({cal.role})
                      </option>
                    ))}
                </optgroup>
              )}
            </Select>
          </div>
        )}

        {isAdminTestAccount && (
          <button
            onClick={toggleTier}
            disabled={toggling}
            title="Testing-only: flips this account's tier so you can click through premium features. Never available for real clients."
            className="mt-1 flex items-center justify-between gap-2 rounded-md border border-dashed border-accent/50 bg-accent-soft/10 px-2 py-1.5 text-left text-[11px] text-text-secondary hover:bg-accent-soft/20 disabled:opacity-60"
          >
            <span>
              Viewing as <span className="font-semibold capitalize text-text-primary">{currentTier}</span>
            </span>
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {toggling ? '…' : `Switch to ${NEXT_TIER[currentTier]}`}
            </span>
          </button>
        )}
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
        {renderGroup('Elite', ELITE_LINKS)}
      </ul>
      <div className="hidden px-4 py-4 md:block">
        <SignOutButton />
      </div>
    </nav>
  );
}
