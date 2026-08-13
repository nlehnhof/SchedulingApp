import type { Appointment, AppointmentReason, GoogleBlock, Rule, Slot } from './types';

export interface GetAvailableSlotsParams {
  startDate: Date; // inclusive, local midnight in client's timezone
  endDate: Date; // inclusive
  reason: AppointmentReason;
  rules: Rule[];
  booked: Appointment[]; // non-expired, non-cancelled appointments for this client
  googleBlocks: GoogleBlock[];
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
}: GetAvailableSlotsParams): Slot[] {
  const durationMs = reason.duration_min * 60 * 1000;
  const slots: Slot[] = [];

  const firstNRule = rules.find((r) => r.rule_type === 'first_n_only');
  const maxPerWindowRule = rules.find((r) => r.rule_type === 'max_per_window');

  for (
    let date = new Date(startDate);
    date <= endDate;
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  ) {
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

      const available = !isBooked && !hasGoogleBlock && withinFirstN && withinMaxPerWindow;

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available,
        reason: available
          ? null
          : isBooked
            ? 'booked'
            : hasGoogleBlock
              ? 'google_calendar_block'
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
