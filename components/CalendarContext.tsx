'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export interface CalendarSummary {
  id: string;
  display_name: string | null;
  slug: string | null;
  created_at: string;
}

interface CalendarContextValue {
  calendarId: string | null;
  calendars: CalendarSummary[];
  limit: number;
  isLoading: boolean;
  setCalendarId: (id: string) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

const COOKIE_NAME = 'gather_calendar_id';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  // 1 year, lax so it survives normal navigation but not cross-site
  // requests — this is a UI preference, not an auth token, so it doesn't
  // need httpOnly (nothing sensitive lives in it, just a calendar id the
  // caller already has API access to check against on every request).
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

// No existing "currently selected X" pattern exists elsewhere in this
// codebase to extend (checked before building this — the closest precedent
// is app/dashboard/schedule/page.tsx threading reasonId/startDate into its
// own fetch's query string via local useState). This introduces that
// convention: a cookie-backed selection, read server-side once at
// app/dashboard/layout.tsx to avoid a flash-of-wrong-calendar on a hard
// reload, then owned client-side here for the rest of the session.
export default function CalendarProvider({
  initialCalendarId,
  children,
}: {
  initialCalendarId: string | null;
  children: React.ReactNode;
}) {
  const { data, isLoading } = useSWR<{ calendars: CalendarSummary[]; limit: number }>(
    '/api/client/calendars',
    fetcher
  );
  const [calendarId, setCalendarIdState] = useState<string | null>(initialCalendarId);

  function setCalendarId(id: string) {
    setCalendarIdState(id);
    writeCookie(COOKIE_NAME, id);
  }

  useEffect(() => {
    if (!data) return;
    const calendars = data.calendars ?? [];
    if (calendars.length === 0) return; // shouldn't happen — every client has >=1 calendar
    const stillValid = calendarId && calendars.some((c) => c.id === calendarId);
    if (!stillValid) {
      // Stale/missing cookie (deleted calendar, first-ever load, or a
      // different account's cookie on a shared browser) — fall back to the
      // first calendar and correct the cookie to match.
      setCalendarId(calendars[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <CalendarContext.Provider
      value={{
        calendarId,
        calendars: data?.calendars ?? [],
        limit: data?.limit ?? 1,
        isLoading,
        setCalendarId,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar() must be used within a CalendarProvider');
  return ctx;
}

// Convenience re-export so callers reading this cookie server-side
// (app/dashboard/layout.tsx) use the exact same name as the client writer.
export { COOKIE_NAME as CALENDAR_COOKIE_NAME };
