import type { Appointment, AppointmentReason, GoogleBlock, Rule, Slot } from './types';
import { toNaiveISOString } from './date-format';

export interface GetAvailableSlotsParams {
  startDate: Date; // inclusive, local midnight in client's timezone
  endDate: Date; // inclusive
  reason: AppointmentReason;
  rules: Rule[];
  booked: Appointment[]; // non-expired, non-cancelled appointments for this client
  googleBlocks: GoogleBlock[];
  // Injectable "current time" for min_notice — defaults to real now. Callers
  // never need to pass this; it exists so tests can pin a deterministic
  // clock instead of racing the real one.
  now?: Date;
}

function parseTimeOnDate(date: Date, hhmmss: string): Date {
  const [h, m, s] = hhmmss.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, s || 0, 0);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function dateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Picks the most specific available_hours rule for a given day of week:
 * a day-specific rule (day_of_week === dow) takes precedence over an
 * "all days" rule (day_of_week === null).
 */
function findAvailableHoursRule(rules: Rule[], dow: number): Rule | undefined {
  const specific = rules.find(
    (r) => r.rule_type === 'available_hours' && r.day_of_week === dow
  );
  if (specific) return specific;
  return rules.find((r) => r.rule_type === 'available_hours' && r.day_of_week === null);
}

/**
 * True when `day` (a local-midnight Date) falls within any blackout rule's
 * [start_date, end_date] (both inclusive, plain 'YYYY-MM-DD' strings in
 * config — see RuleEditor.tsx). Used to skip generating slots on days off
 * entirely (holidays, vacation, etc.) regardless of what available_hours
 * would otherwise allow.
 */
function isBlackedOut(blackoutRules: Rule[], day: Date): boolean {
  const key = dateOnly(day);
  return blackoutRules.some((r) => {
    const startDate = r.config?.start_date;
    const endDate = r.config?.end_date;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') return false;
    return key >= startDate && key <= endDate;
  });
}

/**
 * Pure, DB-free slot calculator. Given rules, a reason, existing bookings, and
 * Google Calendar blocks, returns every candidate slot in the date range with
 * an availability flag. Callers are responsible for fetching the inputs and
 * for scoping "booked"/"googleBlocks" to the right client.
 */
export function getAvailableSlots({
  startDate,
  endDate,
  reason,
  rules,
  booked,
  googleBlocks,
  now,
}: GetAvailableSlotsParams): Slot[] {
  const durationMs = reason.duration_min * 60 * 1000;
  const slots: Slot[] = [];
  const nowResolved = now ?? new Date();

  const firstNRule = rules.find((r) => r.rule_type === 'first_n_only');
  const maxPerWindowRule = rules.find((r) => r.rule_type === 'max_per_window');
  const blackoutRules = rules.filter((r) => r.rule_type === 'blackout');
  const bufferRule = rules.find((r) => r.rule_type === 'buffer_time');
  const minNoticeRule = rules.find((r) => r.rule_type === 'min_notice');

  for (
    let date = new Date(startDate);
    date <= endDate;
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  ) {
    if (isBlackedOut(blackoutRules, date)) continue;

    const dow = date.getDay();
    const availableHours = findAvailableHoursRule(rules, dow);
    if (!availableHours || !availableHours.start_time || !availableHours.end_time) continue;

    const dayStart = parseTimeOnDate(date, availableHours.start_time);
    const dayEnd = parseTimeOnDate(date, availableHours.end_time);

    for (
      let slotStart = new Date(dayStart);
      slotStart.getTime() + durationMs <= dayEnd.getTime();
      slotStart = new Date(slotStart.getTime() + durationMs)
    ) {
      const slotEnd = new Date(slotStart.getTime() + durationMs);

      const isBooked = booked.some((apt) =>
        overlaps(slotStart, slotEnd, new Date(apt.start_time), new Date(apt.end_time))
      );

      const hasGoogleBlock = googleBlocks.some((block) =>
        overlaps(slotStart, slotEnd, new Date(block.start), new Date(block.end))
      );

      let hasBufferConflict = false;
      if (bufferRule?.config && typeof bufferRule.config.buffer_minutes === 'number') {
        const bufferMs = bufferRule.config.buffer_minutes * 60 * 1000;
        hasBufferConflict = booked.some((apt) => {
          const paddedStart = new Date(new Date(apt.start_time).getTime() - bufferMs);
          const paddedEnd = new Date(new Date(apt.end_time).getTime() + bufferMs);
          return overlaps(slotStart, slotEnd, paddedStart, paddedEnd);
        });
      }

      let meetsMinNotice = true;
      if (minNoticeRule?.config && typeof minNoticeRule.config.notice_hours === 'number') {
        const cutoff = new Date(nowResolved.getTime() + minNoticeRule.config.notice_hours * 3600 * 1000);
        meetsMinNotice = slotStart >= cutoff;
      }

      let withinFirstN = true;
      if (firstNRule?.config && typeof firstNRule.config.first_n === 'number') {
        const windowMinutes =
          typeof firstNRule.config.window_minutes === 'number'
            ? firstNRule.config.window_minutes
            : 60;
        const windowStart = new Date(slotStart);
        windowStart.setMinutes(
          Math.floor(windowStart.getMinutes() / windowMinutes) * windowMinutes,
          0,
          0
        );
        const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
        const countInWindow = booked.filter((apt) => {
          const aptStart = new Date(apt.start_time);
          return aptStart >= windowStart && aptStart < windowEnd;
        }).length;
        withinFirstN = countInWindow < firstNRule.config.first_n;
      }

      let withinMaxPerWindow = true;
      if (maxPerWindowRule?.max_concurrent != null) {
        const windowMinutes =
          typeof maxPerWindowRule.config?.window_minutes === 'number'
            ? (maxPerWindowRule.config.window_minutes as number)
            : 60;
        const windowStart = new Date(slotStart);
        windowStart.setMinutes(
          Math.floor(windowStart.getMinutes() / windowMinutes) * windowMinutes,
          0,
          0
        );
        const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
        const countInWindow = booked.filter((apt) => {
          const aptStart = new Date(apt.start_time);
          return aptStart >= windowStart && aptStart < windowEnd;
        }).length;
        withinMaxPerWindow = countInWindow < maxPerWindowRule.max_concurrent;
      }

      const available =
        !isBooked &&
        !hasGoogleBlock &&
        !hasBufferConflict &&
        meetsMinNotice &&
        withinFirstN &&
        withinMaxPerWindow;

      slots.push({
        // toNaiveISOString(), NOT .toISOString() — see lib/date-format.ts's
        // header comment. `.toISOString()` converts to UTC, but
        // appointments.start_time/end_time are Postgres `timestamp` (no
        // time zone) columns that silently drop any offset on write and
        // get re-read as local time — so a UTC-converted value here would
        // come back shifted by the server's UTC offset, which for a
        // late-enough slot rolls it into the next calendar day.
        start: toNaiveISOString(slotStart),
        end: toNaiveISOString(slotEnd),
        available,
        reason: available
          ? null
          : isBooked
            ? 'booked'
            : hasGoogleBlock
              ? 'google_calendar_block'
              : hasBufferConflict
                ? 'buffer_time_conflict'
                : !meetsMinNotice
                  ? 'min_notice_not_met'
                  : !withinFirstN
                    ? 'first_n_limit_reached'
                    : 'max_per_window_reached',
      });
    }
  }

  return slots;
}

export function nextAvailableSlot(slots: Slot[], after?: Date): Slot | undefined {
  return slots.find((s) => s.available && (!after || new Date(s.start) >= after));
}
