/**
 * Shared date-formatting/parsing helpers that exist specifically to avoid a
 * timezone bug that shipped in this app: `appointments.start_time`/
 * `end_time` are Postgres `timestamp` (no time zone) columns (0001_init.sql).
 * Postgres silently ignores any 'Z'/offset on a value written to a
 * `timestamp` column — it just stores the literal digits. So a value
 * produced with `Date.prototype.toISOString()` (which always converts to
 * UTC first) gets its UTC offset silently dropped on the way in, then gets
 * re-interpreted as *local* time on the way back out (`new Date(naiveStr)`
 * parses a no-offset datetime string as local time, per spec). That's a
 * systematic shift by exactly the browser/server's UTC offset which, for a
 * late-enough appointment, pushes the displayed date into the next day —
 * this is exactly why a Saturday-evening slot could show as Sunday on the
 * client dashboard while the visitor booking flow (which never round-trips
 * through the DB before displaying its own confirmation) still showed
 * Saturday.
 *
 * The fix is to never let a value cross the DB boundary via `.toISOString()`
 * — use toNaiveISOString() instead, which keeps the same *local* wall-clock
 * components the rest of the app already assumes (manual appointment edits
 * via a <input type="datetime-local"> were naive by construction and never
 * had this bug).
 */

/**
 * Formats a Date's *local* wall-clock components with no 'Z'/offset — e.g.
 * "2026-08-15T21:00:00.000". Use this instead of `.toISOString()` (which
 * converts to UTC first) anywhere a Date is about to be sent to the DB or
 * to another part of the app that will parse it back with `new Date()`.
 */
export function toNaiveISOString(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}`
  );
}

/**
 * Parses a plain 'YYYY-MM-DD' string into a Date at *local* midnight.
 * `new Date('YYYY-MM-DD')` is a classic trap: a date-only ISO string is
 * parsed as UTC midnight (per spec — unlike a full datetime string with no
 * offset, which parses as local), so formatting it with `.toLocaleDateString()`
 * silently shows the previous day in any timezone behind UTC (Denver
 * included). Always use this instead of `new Date(dateOnlyString)` when the
 * string is a bucket/grouping key like `slot.start.slice(0, 10)`.
 */
export function parseLocalDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date's *local* year/month/day as a plain 'YYYY-MM-DD' string —
 * the inverse of parseLocalDateOnly(). Use this instead of
 * `.toISOString().slice(0, 10)` anywhere a Date is being turned into a
 * date-only bucket/grouping key: `.toISOString()` converts to UTC first,
 * which rolls the date backward or forward by one near midnight in any
 * timezone that isn't UTC.
 */
export function formatLocalDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
