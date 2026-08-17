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

/**
 * Builds the list of duration_min-sized [start, end) intervals within
 * [dayStart, dayEnd), always returned in ascending chronological order
 * regardless of fill direction — direction only decides which end of the
 * window absorbs a remainder that doesn't evenly divide into full slots.
 */
function computeSlotIntervals(
  dayStart: Date,
  dayEnd: Date,
  durationMs: number,
  direction: 'forward' | 'backward'
): { start: Date; end: Date }[] {
  const intervals: { start: Date; end: Date }[] = [];
  if (direction === 'backward') {
    for (
      let slotEnd = new Date(dayEnd);
      slotEnd.getTime() - durationMs >= dayStart.getTime();
      slotEnd = new Date(slotEnd.getTime() - durationMs)
    ) {
      const slotStart = new Date(slotEnd.getTime() - durationMs);
      intervals.unshift({ start: slotStart, end: slotEnd });
    }
  } else {
    for (
      let slotStart = new Date(dayStart);
      slotStart.getTime() + durationMs <= dayEnd.getTime();
      slotStart = new Date(slotStart.getTime() + durationMs)
    ) {
      intervals.push({ start: slotStart, end: new Date(slotStart.getTime() + durationMs) });
    }
  }
  return intervals;
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
 * Picks every available_hours rule that applies to a given day of week — a
 * calendar can have several disjoint windows on the same day (e.g. an 8-11
 * block and a separate 12-2:30 block), each with its own fill direction. Any
 * day-specific rule (day_of_week === dow) takes precedence over "all days"
 * rules (day_of_week === null) — if at least one day-specific rule exists
 * for this day, the all-days rules are ignored entirely for it, same
 * precedence as before this supported multiple rules per day.
 */
function findDayRules(rules: Rule[], dow: number): Rule[] {
  const specific = rules.filter(
    (r) => r.rule_type === 'available_hours' && r.day_of_week === dow
  );
  if (specific.length > 0) return specific;
  return rules.filter((r) => r.rule_type === 'available_hours' && r.day_of_week === null);
}

/**
 * Picks every `specific_dates` rule whose config.dates includes this exact
 * calendar date, if any. A match is authoritative for that date — it opens
 * the day using its own start/end time(s) even if no available_hours rule
 * exists for that weekday at all (see findDayRules above), which is what
 * lets a client open one specific date without changing their weekday
 * schedule.
 */
function findSpecificDateRules(rules: Rule[], dateKey: string): Rule[] {
  return rules.filter((r) => {
    if (r.rule_type !== 'specific_dates') return false;
    const dates = r.config?.dates;
    return Array.isArray(dates) && dates.includes(dateKey);
  });
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
 * Per-rule, not per-calendar: each available_hours/specific_dates block
 * picks its own fill direction via config.fill_direction, defaulting to
 * 'forward' when absent — see RuleEditor.tsx's "Fill direction" field.
 */
function ruleFillDirection(rule: Rule): 'forward' | 'backward' {
  return rule.config?.fill_direction === 'backward' ? 'backward' : 'forward';
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
  const sequentialFillRule = rules.find((r) => r.rule_type === 'sequential_fill');

  for (
    let date = new Date(startDate);
    date <= endDate;
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  ) {
    if (isBlackedOut(blackoutRules, date)) continue;

    const dow = date.getDay();
    const dateKey = dateOnly(date);
    // A day can have several disjoint available_hours windows (e.g. an 8-11
    // block and a separate 12-2:30 block) — specific_dates rules for this
    // exact date are authoritative and fully replace the weekday rules when
    // present, same override semantics as before multiple rules per day
    // were supported.
    const specificDateRules = findSpecificDateRules(rules, dateKey);
    const dayRules = (specificDateRules.length > 0 ? specificDateRules : findDayRules(rules, dow)).filter(
      (r) => r.start_time && r.end_time
    );
    if (dayRules.length === 0) continue;

    const windows = dayRules.map((rule) => ({
      rule,
      dayStart: parseTimeOnDate(date, rule.start_time as string),
      dayEnd: parseTimeOnDate(date, rule.end_time as string),
    }));

    // sequential_fill: the "frontier" is how far into the day bookings have
    // progressed so far — the earliest of the day's window starts until
    // something is booked, then the latest booked appointment's end time on
    // that same day. Slots are only offered within max_gap_minutes of the
    // frontier, which nudges visitors toward the earliest open slot instead
    // of cherry-picking a late one and leaving gaps behind it. This is a
    // single per-day value shared across all of the day's windows, not
    // recomputed per window.
    //
    // The frontier also has to walk forward past any Google Calendar block
    // that already occupies the start of the window, not just real
    // bookings. Without this, a practitioner whose available window opens
    // straight into an existing Google Calendar commitment (a standing
    // meeting, etc.) with zero appointments booked yet hits a permanent
    // deadlock: the frontier never leaves dayStart because nothing has been
    // booked, but dayStart itself is never actually offerable (it's inside
    // the Google block), so nothing is ever bookable to advance it either.
    // This shipped as a live bug once — see the "sequential_fill deadlocks
    // on a leading Google Calendar block" test.
    let sequentialFrontier: Date | null = null;
    if (
      sequentialFillRule?.config &&
      typeof sequentialFillRule.config.max_gap_minutes === 'number'
    ) {
      const dayKey = dateOnly(date);
      const dayBusyPeriods = [
        ...booked
          .filter((apt) => dateOnly(new Date(apt.start_time)) === dayKey)
          .map((apt) => ({ start: new Date(apt.start_time), end: new Date(apt.end_time) })),
        ...googleBlocks
          .filter((block) => dateOnly(new Date(block.start)) === dayKey)
          .map((block) => ({ start: new Date(block.start), end: new Date(block.end) })),
      ];

      let frontier = new Date(Math.min(...windows.map((w) => w.dayStart.getTime())));
      let advanced = true;
      while (advanced) {
        advanced = false;
        for (const period of dayBusyPeriods) {
          if (period.start <= frontier && period.end > frontier) {
            frontier = period.end;
            advanced = true;
          }
        }
      }
      sequentialFrontier = frontier;
    }

    const daySlots: Slot[] = [];
    const seenStarts = new Set<number>();

    for (const { rule, dayStart, dayEnd } of windows) {
      const intervals = computeSlotIntervals(dayStart, dayEnd, durationMs, ruleFillDirection(rule));
      for (const { start: slotStart, end: slotEnd } of intervals) {
        // Guards against two windows on the same day producing the exact
        // same slot start (shouldn't happen with sane, non-overlapping
        // rule config, but stays defensive rather than emitting a
        // duplicate the visitor UI would render twice).
        if (seenStarts.has(slotStart.getTime())) continue;
        seenStarts.add(slotStart.getTime());

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

        let withinSequentialFill = true;
        if (sequentialFrontier && sequentialFillRule?.config) {
          const maxGapMs = (sequentialFillRule.config.max_gap_minutes as number) * 60 * 1000;
          withinSequentialFill = slotStart.getTime() <= sequentialFrontier.getTime() + maxGapMs;
        }

        const available =
          !isBooked &&
          !hasGoogleBlock &&
          !hasBufferConflict &&
          meetsMinNotice &&
          withinFirstN &&
          withinMaxPerWindow &&
          withinSequentialFill;

        daySlots.push({
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
                      : !withinMaxPerWindow
                        ? 'max_per_window_reached'
                        : 'sequential_fill_gap_exceeded',
        });
      }
    }

    // Windows can be processed out of chronological order (their fill
    // directions differ), so sort the day's slots back into ascending
    // start-time order before appending — visitor UI groups by date/time
    // and expects each date's slots ordered.
    daySlots.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    slots.push(...daySlots);
  }

  return slots;
}

export function nextAvailableSlot(slots: Slot[], after?: Date): Slot | undefined {
  return slots.find((s) => s.available && (!after || new Date(s.start) >= after));
}
