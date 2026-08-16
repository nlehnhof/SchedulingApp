'use client';

import { useState } from 'react';
import DashboardNav from './DashboardNav';
import OnboardingTour from './OnboardingTour';
import CalendarProvider from './CalendarContext';
import type { Tier } from '@/lib/tier';

// Client-side container so the nav's "Replay tutorial" button and the tour
// overlay can share open/close state without needing a session provider or
// prop-drilling through the server layout on every navigation. The server
// layout (app/dashboard/layout.tsx) only ever passes down plain,
// session-derived values it already has. Also owns the calendar-switcher
// state (CalendarProvider) since it's the one client layer already
// wrapping every dashboard page.
export default function DashboardChrome({
  email,
  tier,
  tutorialCompletedAt,
  isAdminTestAccount,
  initialCalendarId,
  children,
}: {
  email?: string | null;
  tier: Tier;
  tutorialCompletedAt: string | null;
  isAdminTestAccount?: boolean;
  initialCalendarId: string | null;
  children: React.ReactNode;
}) {
  const [tourOpen, setTourOpen] = useState(tutorialCompletedAt === null);

  return (
    <CalendarProvider initialCalendarId={initialCalendarId}>
      <div className="flex min-h-screen flex-col bg-background md:flex-row">
        <DashboardNav
          email={email}
          tier={tier}
          isAdminTestAccount={isAdminTestAccount}
          onReplayTutorial={() => setTourOpen(true)}
        />
        <main className="flex-1 p-4 md:p-8">{children}</main>
        <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      </div>
    </CalendarProvider>
  );
}
