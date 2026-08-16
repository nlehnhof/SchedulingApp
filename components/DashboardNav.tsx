'use client';

import { useState } from 'react';
import Link from 'next/link';
import { List, Question } from '@phosphor-icons/react';
import { usePathname, useRouter } from 'next/navigation';
import SignOutButton from './SignOutButton';
import Select from './Select';
import Modal from './Modal';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Shared between the desktop sidebar and the mobile drawer (previously
  // the mobile nav lost this entirely — email, calendar switcher, and dev
  // tier toggle were all `hidden md:block`). `onNavigate` closes the drawer
  // after a link tap; it's a no-op on desktop, where nothing is listening.
  function accountBlock(onNavigate?: () => void) {
    return (
      <div className="flex flex-col gap-1">
        <span className="truncate text-xs text-text-2">{email}</span>

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
              onChange={(e) => {
                setCalendarId(e.target.value);
                onNavigate?.();
              }}
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
            className="mt-1 flex items-center justify-between gap-2 rounded-md border border-dashed border-lume/50 bg-lume/10 px-2 py-1.5 text-left text-[11px] text-text-2 hover:bg-lume/20 disabled:opacity-60"
          >
            <span>
              Viewing as <span className="font-semibold capitalize text-text">{currentTier}</span>
            </span>
            <span className="rounded-full bg-lume px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {toggling ? '…' : `Switch to ${NEXT_TIER[currentTier]}`}
            </span>
          </button>
        )}
      </div>
    );
  }

  function renderGroup(label: string, links: NavLink[], onNavigate?: () => void) {
    return (
      <li>
        <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-text-2/70">
          {label}
        </div>
        <ul className="flex flex-col">
          {links.map((link) => {
            const active = pathname === link.href;
            const locked = !!link.minTier && !isAtLeast(currentTier, link.minTier);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  className={`flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-lume/30 text-text'
                      : 'text-text-2 hover:bg-lume/15'
                  }`}
                >
                  <span>{link.label}</span>
                  {locked && (
                    <span className="rounded-full bg-lume/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-lume-bright">
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

  function navLinks(onNavigate?: () => void) {
    return (
      <ul className="flex flex-col">
        <li>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={`flex min-h-11 items-center whitespace-nowrap rounded-md px-4 py-3 text-sm font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'bg-lume/30 text-text'
                : 'text-text-2 hover:bg-lume/15'
            }`}
          >
            Home
          </Link>
        </li>
        {renderGroup('Setup', SETUP_LINKS, onNavigate)}
        {renderGroup('Operate', OPERATE_LINKS, onNavigate)}
        {renderGroup('Premium', PREMIUM_LINKS, onNavigate)}
        {renderGroup('Elite', ELITE_LINKS, onNavigate)}
      </ul>
    );
  }

  return (
    <>
      {/* Slim mobile top bar — replaces the old unlabeled horizontal-scroll
          link strip, which had no group headers and no way to reach the
          brand, calendar switcher, or sign-out at all below md. */}
      <div className="flex items-center gap-1 border-b border-hairline bg-surface px-2 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-md text-text-2 hover:bg-lume/20"
        >
          <List size={20} weight="regular" />
        </button>
        <span className="font-display text-lg font-semibold text-text">Gather</span>
      </div>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="drawer"
        closeOnBackdropClick
        title="Menu"
      >
        <div className="flex flex-col gap-3">
          {onReplayTutorial && (
            <button
              onClick={() => {
                onReplayTutorial();
                setDrawerOpen(false);
              }}
              className="w-fit rounded-md border border-edge px-2 py-1 text-left text-xs text-text-2 hover:bg-lume/20"
            >
              Replay tutorial
            </button>
          )}
          {accountBlock(() => setDrawerOpen(false))}
          {navLinks(() => setDrawerOpen(false))}
          <div className="mt-2 border-t border-hairline pt-3">
            <SignOutButton />
          </div>
        </div>
      </Modal>

      <nav className="hidden shrink-0 md:flex md:w-56 md:flex-col md:border-r md:border-hairline md:bg-surface">
        <div className="flex flex-col gap-1 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-text">Gather</span>
            {onReplayTutorial && (
              <button
                onClick={onReplayTutorial}
                aria-label="Replay tutorial"
                title="Replay tutorial"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-edge text-text-2 hover:bg-lume/20"
              >
                <Question size={14} weight="regular" />
              </button>
            )}
          </div>
          {accountBlock()}
        </div>
        {navLinks()}
        <div className="px-4 py-4">
          <SignOutButton />
        </div>
      </nav>
    </>
  );
}
