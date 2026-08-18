// A curated subset, not every IANA zone — Intl.supportedValuesOf('timeZone')
// would be exhaustive but overwhelming for a dropdown; the server accepts
// any valid IANA name regardless (lib/validation.ts's calendarSelectSchema
// validates via Intl.DateTimeFormat, not against this list). Shared between
// the onboarding timezone step (OnboardingTour.tsx) and the calendar
// settings page (app/dashboard/calendar/page.tsx) so the two pickers never
// drift apart.
export const TIMEZONE_OPTIONS = [
  { id: 'Pacific/Honolulu', label: 'Hawaii' },
  { id: 'America/Anchorage', label: 'Alaska' },
  { id: 'America/Los_Angeles', label: 'Pacific (US & Canada)' },
  { id: 'America/Denver', label: 'Mountain (US & Canada)' },
  { id: 'America/Phoenix', label: 'Arizona (no DST)' },
  { id: 'America/Chicago', label: 'Central (US & Canada)' },
  { id: 'America/New_York', label: 'Eastern (US & Canada)' },
  { id: 'America/Puerto_Rico', label: 'Atlantic (Puerto Rico)' },
  { id: 'Europe/London', label: 'London' },
  { id: 'Europe/Paris', label: 'Paris/Berlin/Madrid' },
  { id: 'UTC', label: 'UTC' },
];

/** Browser-reported IANA zone, e.g. "America/Denver". Never run server-side — Render runs in UTC. */
export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
