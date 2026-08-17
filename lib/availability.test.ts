import { describe, expect, it } from 'vitest';
import { getAvailableSlots, nextAvailableSlot } from './availability';
import { toNaiveISOString } from './date-format';
import type { Appointment, AppointmentReason, GoogleBlock, Rule } from './types';

const reason: AppointmentReason = {
  id: 'reason-1',
  calendar_id: 'client-1',
  name: 'Recommend',
  duration_min: 15,
  order: 1,
  info_note: null,
  required_checkboxes: [],
};

const allDaysHours: Rule = {
  id: 'rule-hours',
  calendar_id: 'client-1',
  rule_type: 'available_hours',
  day_of_week: null,
  start_time: '09:00:00',
  end_time: '10:00:00',
  max_concurrent: null,
  config: { permanent: true },
};

function makeAppointment(startISO: string, endISO: string): Appointment {
  return {
    id: 'apt-' + startISO,
    calendar_id: 'client-1',
    visitor_name: 'Jane',
    visitor_phone: '555-1234',
    visitor_email: 'jane@example.com',
    reason_id: reason.id,
    start_time: startISO,
    end_time: endISO,
    notes: null,
    status: 'confirmed',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    google_event_id: null,
  };
}

describe('getAvailableSlots', () => {
  it('generates duration-sized slots within available_hours', () => {
    const day = new Date('2026-08-17T00:00:00'); // a Monday
    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours],
      booked: [],
      googleBlocks: [],
    });

    // 09:00-10:00 in 15-min increments = 4 slots
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('fillDirection "forward" (default) leaves a leftover gap at the end of the window', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday, 09:00-10:00
    const oddDurationReason: AppointmentReason = { ...reason, duration_min: 25 };
    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason: oddDurationReason,
      rules: [allDaysHours],
      booked: [],
      googleBlocks: [],
    });

    // 25-min slots don't divide evenly into a 60-min window: 09:00-09:25,
    // 09:25-09:50, then 09:50+25=10:15 doesn't fit — 09:50-10:00 goes unused.
    expect(slots.map((s) => s.start.slice(11, 16))).toEqual(['09:00', '09:25']);
    expect(slots[slots.length - 1].end.slice(11, 16)).toBe('09:50');
  });

  it('fillDirection "backward" leaves the same leftover at the start instead of the end', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday, 09:00-10:00
    const oddDurationReason: AppointmentReason = { ...reason, duration_min: 25 };
    const backwardHours: Rule = {
      ...allDaysHours,
      config: { permanent: true, fill_direction: 'backward' },
    };
    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason: oddDurationReason,
      rules: [backwardHours],
      booked: [],
      googleBlocks: [],
    });

    // Anchored to 10:00 and working backward: 09:35-10:00, then 09:10-09:35,
    // then 08:45-09:10 doesn't fit — 09:00-09:10 goes unused. Still returned
    // in ascending chronological order.
    expect(slots.map((s) => s.start.slice(11, 16))).toEqual(['09:10', '09:35']);
    expect(slots[slots.length - 1].end.slice(11, 16)).toBe('10:00');
  });

  it('fill direction is per available_hours rule, not one setting for the whole calendar', () => {
    // Monday forward (default), Tuesday backward — two day-specific rules in
    // the same rule set, each carrying its own config.fill_direction. This
    // is the whole point of the per-rule change: no shared calendar-level
    // setting controls both days.
    const mondayForward: Rule = {
      ...allDaysHours,
      id: 'rule-monday',
      day_of_week: 1,
      config: { fill_direction: 'forward' },
    };
    const tuesdayBackward: Rule = {
      ...allDaysHours,
      id: 'rule-tuesday',
      day_of_week: 2,
      config: { fill_direction: 'backward' },
    };
    const oddDurationReason: AppointmentReason = { ...reason, duration_min: 25 };
    const monday = new Date('2026-08-17T00:00:00');
    const tuesday = new Date('2026-08-18T00:00:00');

    const slots = getAvailableSlots({
      startDate: monday,
      endDate: tuesday,
      reason: oddDurationReason,
      rules: [mondayForward, tuesdayBackward],
      booked: [],
      googleBlocks: [],
    });

    const mondaySlots = slots.filter((s) => s.start.startsWith('2026-08-17'));
    const tuesdaySlots = slots.filter((s) => s.start.startsWith('2026-08-18'));
    expect(mondaySlots.map((s) => s.start.slice(11, 16))).toEqual(['09:00', '09:25']);
    expect(tuesdaySlots.map((s) => s.start.slice(11, 16))).toEqual(['09:10', '09:35']);
  });

  // Regression guard for the Saturday/Sunday display bug: slot.start/end
  // must stay a naive local string (no 'Z'/offset) that round-trips through
  // a Postgres `timestamp` (no time zone) column without shifting days. If
  // this starts failing, someone likely reintroduced `.toISOString()` in
  // lib/availability.ts's slots.push() — see lib/date-format.ts for why
  // that silently rolls late-day slots into the next calendar day.
  it('emits naive local datetime strings with no UTC offset', () => {
    const day = new Date('2026-08-15T00:00:00'); // a Saturday
    const lateHours: Rule = {
      ...allDaysHours,
      id: 'rule-late',
      start_time: '22:00:00',
      end_time: '23:00:00',
    };
    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [lateHours],
      booked: [],
      googleBlocks: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start).not.toMatch(/Z$/);
      expect(slot.start.slice(0, 10)).toBe('2026-08-15'); // still Saturday
    }
  });

  it('marks a slot unavailable when it overlaps a booked appointment', () => {
    const day = new Date('2026-08-17T00:00:00');
    const bookedStart = new Date(day);
    bookedStart.setHours(9, 0, 0, 0);
    const bookedEnd = new Date(day);
    bookedEnd.setHours(9, 15, 0, 0);

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours],
      booked: [makeAppointment(bookedStart.toISOString(), bookedEnd.toISOString())],
      googleBlocks: [],
    });

    const first = slots[0];
    expect(first.available).toBe(false);
    expect(first.reason).toBe('booked');
    expect(slots.slice(1).every((s) => s.available)).toBe(true);
  });

  it('marks a slot unavailable when it overlaps a Google Calendar block', () => {
    const day = new Date('2026-08-17T00:00:00');
    const blockStart = new Date(day);
    blockStart.setHours(9, 30, 0, 0);
    const blockEnd = new Date(day);
    blockEnd.setHours(10, 0, 0, 0);

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours],
      booked: [],
      googleBlocks: [{ id: 'g1', summary: 'Busy', start: blockStart.toISOString(), end: blockEnd.toISOString() }],
    });

    expect(slots[2].available).toBe(false);
    expect(slots[2].reason).toBe('google_calendar_block');
  });

  it('enforces a first_n_only rule within a window', () => {
    const day = new Date('2026-08-17T00:00:00');
    const firstNRule: Rule = {
      id: 'rule-first-n',
      calendar_id: 'client-1',
      rule_type: 'first_n_only',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { first_n: 2, window_minutes: 60 },
    };

    const b1Start = new Date(day);
    b1Start.setHours(9, 0, 0, 0);
    const b1End = new Date(day);
    b1End.setHours(9, 15, 0, 0);
    const b2Start = new Date(day);
    b2Start.setHours(9, 15, 0, 0);
    const b2End = new Date(day);
    b2End.setHours(9, 30, 0, 0);

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, firstNRule],
      booked: [
        makeAppointment(b1Start.toISOString(), b1End.toISOString()),
        makeAppointment(b2Start.toISOString(), b2End.toISOString()),
      ],
      googleBlocks: [],
    });

    // Both booked slots are themselves unavailable (booked); the two
    // remaining open slots in the same 60-min window should be blocked by
    // first_n_only since 2 appointments already exist in that window.
    const remaining = slots.filter((s) => s.reason !== 'booked');
    expect(remaining.every((s) => !s.available)).toBe(true);
    expect(remaining.every((s) => s.reason === 'first_n_limit_reached')).toBe(true);
  });

  it('day-specific available_hours rule overrides the all-days rule', () => {
    const monday = new Date('2026-08-17T00:00:00'); // Monday
    const mondayOverride: Rule = {
      id: 'rule-monday',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 1, // Monday
      start_time: '13:00:00',
      end_time: '14:00:00',
      max_concurrent: null,
      config: null,
    };

    const slots = getAvailableSlots({
      startDate: monday,
      endDate: monday,
      reason,
      rules: [allDaysHours, mondayOverride],
      booked: [],
      googleBlocks: [],
    });

    expect(slots[0].start.slice(11, 16)).not.toBe('09:00');
  });

  it('a specific_dates rule opens a date with no matching weekday rule', () => {
    const sunday = new Date('2026-08-16T00:00:00'); // a Sunday; allDaysHours also covers it,
    // so use a calendar with only a Wednesday rule to prove the specific date needs no
    // weekday rule of its own.
    const wednesdayOnly: Rule = {
      id: 'rule-wed',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 3,
      start_time: '09:00:00',
      end_time: '10:00:00',
      max_concurrent: null,
      config: null,
    };
    const specificDateRule: Rule = {
      id: 'rule-specific',
      calendar_id: 'client-1',
      rule_type: 'specific_dates',
      day_of_week: null,
      start_time: '12:00:00',
      end_time: '13:00:00',
      max_concurrent: null,
      config: { dates: ['2026-08-16'] },
    };

    const slots = getAvailableSlots({
      startDate: sunday,
      endDate: sunday,
      reason,
      rules: [wednesdayOnly, specificDateRule],
      booked: [],
      googleBlocks: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.start.slice(11, 16) >= '12:00' && s.start.slice(11, 16) < '13:00')).toBe(
      true
    );
  });

  it('a specific_dates rule overrides the weekday hours for that exact date', () => {
    const monday = new Date('2026-08-17T00:00:00'); // Monday; allDaysHours covers 09:00-10:00
    const specificDateRule: Rule = {
      id: 'rule-specific',
      calendar_id: 'client-1',
      rule_type: 'specific_dates',
      day_of_week: null,
      start_time: '15:00:00',
      end_time: '16:00:00',
      max_concurrent: null,
      config: { dates: ['2026-08-17'] },
    };

    const slots = getAvailableSlots({
      startDate: monday,
      endDate: monday,
      reason,
      rules: [allDaysHours, specificDateRule],
      booked: [],
      googleBlocks: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.start.slice(11, 16) >= '15:00' && s.start.slice(11, 16) < '16:00')).toBe(
      true
    );
  });

  it('a blackout still suppresses a date even when a specific_dates rule also covers it', () => {
    const monday = new Date('2026-08-17T00:00:00'); // Monday
    const specificDateRule: Rule = {
      id: 'rule-specific',
      calendar_id: 'client-1',
      rule_type: 'specific_dates',
      day_of_week: null,
      start_time: '15:00:00',
      end_time: '16:00:00',
      max_concurrent: null,
      config: { dates: ['2026-08-17'] },
    };
    const blackoutRule: Rule = {
      id: 'rule-blackout',
      calendar_id: 'client-1',
      rule_type: 'blackout',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { start_date: '2026-08-17', end_date: '2026-08-17' },
    };

    const slots = getAvailableSlots({
      startDate: monday,
      endDate: monday,
      reason,
      rules: [allDaysHours, specificDateRule, blackoutRule],
      booked: [],
      googleBlocks: [],
    });

    expect(slots).toHaveLength(0);
  });

  it('generates no slots on a blacked-out day', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday
    const blackoutRule: Rule = {
      id: 'rule-blackout',
      calendar_id: 'client-1',
      rule_type: 'blackout',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { start_date: '2026-08-17', end_date: '2026-08-17' },
    };

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, blackoutRule],
      booked: [],
      googleBlocks: [],
    });

    expect(slots).toHaveLength(0);
  });

  it('a multi-day blackout range does not affect days outside it', () => {
    const start = new Date('2026-08-17T00:00:00'); // Monday
    const end = new Date('2026-08-19T00:00:00'); // Wednesday
    const blackoutRule: Rule = {
      id: 'rule-blackout',
      calendar_id: 'client-1',
      rule_type: 'blackout',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { start_date: '2026-08-17', end_date: '2026-08-18' },
    };

    const slots = getAvailableSlots({
      startDate: start,
      endDate: end,
      reason,
      rules: [allDaysHours, blackoutRule],
      booked: [],
      googleBlocks: [],
    });

    // Only Wednesday (08-19) should have generated slots.
    expect(slots.every((s) => s.start.slice(0, 10) === '2026-08-19')).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('enforces a buffer_time rule around a booked appointment', () => {
    const day = new Date('2026-08-17T00:00:00');
    const bufferRule: Rule = {
      id: 'rule-buffer',
      calendar_id: 'client-1',
      rule_type: 'buffer_time',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { buffer_minutes: 15 },
    };

    const bookedStart = new Date(day);
    bookedStart.setHours(9, 15, 0, 0);
    const bookedEnd = new Date(day);
    bookedEnd.setHours(9, 30, 0, 0);

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, bufferRule],
      booked: [makeAppointment(bookedStart.toISOString(), bookedEnd.toISOString())],
      googleBlocks: [],
    });

    // 09:00-09:15 slot: within 15-min buffer before the 09:15 booking.
    const buffered = slots.find((s) => s.start.slice(11, 16) === '09:00');
    expect(buffered?.available).toBe(false);
    expect(buffered?.reason).toBe('buffer_time_conflict');

    // 09:45-10:00 slot: outside the buffer on the far side of the booking.
    const clear = slots.find((s) => s.start.slice(11, 16) === '09:45');
    expect(clear?.available).toBe(true);
  });

  it('enforces a min_notice rule relative to an injected "now"', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday
    const now = new Date(day);
    now.setHours(8, 0, 0, 0); // 1 hour before the 09:00 window opens
    const minNoticeRule: Rule = {
      id: 'rule-notice',
      calendar_id: 'client-1',
      rule_type: 'min_notice',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { notice_hours: 2 }, // requires booking by 06:00, but it's already 08:00
    };

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, minNoticeRule],
      booked: [],
      googleBlocks: [],
      now,
    });

    expect(slots.every((s) => !s.available)).toBe(true);
    expect(slots.every((s) => s.reason === 'min_notice_not_met')).toBe(true);
  });

  it('enforces a sequential_fill rule, revealing later slots as earlier ones book', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday, 09:00-10:00 in 15-min slots
    const sequentialFillRule: Rule = {
      id: 'rule-sequential',
      calendar_id: 'client-1',
      rule_type: 'sequential_fill',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { max_gap_minutes: 15 },
    };

    // Nothing booked yet: only slots within 15 min of day start (09:00) are open.
    const empty = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, sequentialFillRule],
      booked: [],
      googleBlocks: [],
    });
    expect(empty.find((s) => s.start.slice(11, 16) === '09:00')?.available).toBe(true);
    expect(empty.find((s) => s.start.slice(11, 16) === '09:15')?.available).toBe(true);
    const blocked930 = empty.find((s) => s.start.slice(11, 16) === '09:30');
    expect(blocked930?.available).toBe(false);
    expect(blocked930?.reason).toBe('sequential_fill_gap_exceeded');

    // Once 09:00-09:15 is booked, the frontier moves to 09:15 and 09:30 opens up.
    const bookedStart = new Date(day);
    bookedStart.setHours(9, 0, 0, 0);
    const bookedEnd = new Date(day);
    bookedEnd.setHours(9, 15, 0, 0);
    const afterOneBooking = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, sequentialFillRule],
      booked: [makeAppointment(bookedStart.toISOString(), bookedEnd.toISOString())],
      googleBlocks: [],
    });
    expect(afterOneBooking.find((s) => s.start.slice(11, 16) === '09:30')?.available).toBe(true);
    expect(afterOneBooking.find((s) => s.start.slice(11, 16) === '09:45')?.available).toBe(false);
  });

  it('sequential_fill does not deadlock on a leading Google Calendar block', () => {
    // Regression: a practitioner with zero real bookings yet, but a
    // recurring Google Calendar commitment sitting at the start of their
    // available window (e.g. a standing Sunday meeting), got zero slots
    // every single day forever — the frontier stayed pinned at dayStart
    // (nothing booked to move it), but dayStart itself was inside the
    // Google block, so nothing could ever pass both checks to book and
    // advance the frontier. The frontier must walk forward past a leading
    // Google block just like it does past a leading real booking.
    const day = new Date('2026-08-17T00:00:00'); // Monday, 09:00-10:00 in 15-min slots
    const sequentialFillRule: Rule = {
      id: 'rule-sequential',
      calendar_id: 'client-1',
      rule_type: 'sequential_fill',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { max_gap_minutes: 15 },
    };
    const leadingBlockStart = new Date(day);
    leadingBlockStart.setHours(8, 45, 0, 0);
    const leadingBlockEnd = new Date(day);
    leadingBlockEnd.setHours(9, 20, 0, 0);
    const googleBlocks: GoogleBlock[] = [
      {
        id: 'g1',
        summary: 'Standing meeting',
        start: toNaiveISOString(leadingBlockStart).slice(0, 19),
        end: toNaiveISOString(leadingBlockEnd).slice(0, 19),
      },
    ];

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours, sequentialFillRule],
      booked: [],
      googleBlocks,
    });

    // Without the fix, every slot comes back unavailable (deadlocked).
    expect(slots.some((s) => s.available)).toBe(true);
    // 09:00-09:15 and 09:15-09:30 are still inside the Google block.
    expect(slots.find((s) => s.start.slice(11, 16) === '09:00')?.available).toBe(false);
    expect(slots.find((s) => s.start.slice(11, 16) === '09:15')?.available).toBe(false);
    // The frontier walked to 09:20 (block end), so 09:20's slot opens up —
    // 09:30 is the next slot boundary >= the block end.
    expect(slots.find((s) => s.start.slice(11, 16) === '09:30')?.available).toBe(true);
    expect(slots.find((s) => s.start.slice(11, 16) === '09:45')?.available).toBe(false);
  });

  it('supports multiple disjoint available_hours windows on the same day, each keeping its own fill direction', () => {
    // Regression: a calendar with two Sunday windows (e.g. 8-11 and
    // 12-2:30) only ever got slots from whichever rule the DB happened to
    // return first — the other was silently dropped. Both must contribute
    // slots, and each keeps its own fill_direction independently.
    const day = new Date('2026-08-17T00:00:00'); // Monday
    const reasonWithRemainder: AppointmentReason = { ...reason, duration_min: 25 };
    const morningWindow: Rule = {
      id: 'rule-morning',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 1,
      start_time: '08:00:00',
      end_time: '09:00:00',
      max_concurrent: null,
      config: { permanent: false, fill_direction: 'forward' },
    };
    const afternoonWindow: Rule = {
      id: 'rule-afternoon',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 1,
      start_time: '12:00:00',
      end_time: '13:00:00',
      max_concurrent: null,
      config: { permanent: false, fill_direction: 'backward' },
    };

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason: reasonWithRemainder,
      rules: [morningWindow, afternoonWindow],
      booked: [],
      googleBlocks: [],
    });

    // Forward window's remainder sits at the end (08:00-08:25, 08:25-08:50,
    // 08:50-09:00 unused); backward window's remainder sits at the start
    // (12:00-12:10 unused, 12:10-12:35, 12:35-13:00), all in chronological
    // order across both windows.
    const starts = slots.map((s) => s.start.slice(11, 16));
    expect(starts).toEqual(['08:00', '08:25', '12:10', '12:35']);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('sequential_fill frontier is independent per window, not shared for the whole day', () => {
    // Regression: a Google Calendar block eating into one window (8-11)
    // used to push a single, day-wide sequential_fill frontier past a
    // second, disjoint window (12-2:30) entirely, blocking every slot in
    // it even though nothing was actually busy there yet. Each window must
    // track its own progress.
    const day = new Date('2026-08-17T00:00:00'); // Monday
    const morningWindow: Rule = {
      id: 'rule-morning',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 1,
      start_time: '08:00:00',
      end_time: '11:00:00',
      max_concurrent: null,
      config: { permanent: false, fill_direction: 'forward' },
    };
    const afternoonWindow: Rule = {
      id: 'rule-afternoon',
      calendar_id: 'client-1',
      rule_type: 'available_hours',
      day_of_week: 1,
      start_time: '12:00:00',
      end_time: '13:00:00',
      max_concurrent: null,
      config: { permanent: false, fill_direction: 'forward' },
    };
    const sequentialFillRule: Rule = {
      id: 'rule-sequential',
      calendar_id: 'client-1',
      rule_type: 'sequential_fill',
      day_of_week: null,
      start_time: null,
      end_time: null,
      max_concurrent: null,
      config: { max_gap_minutes: 30 },
    };
    const blockStart = new Date(day);
    blockStart.setHours(8, 0, 0, 0);
    const blockEnd = new Date(day);
    blockEnd.setHours(10, 45, 0, 0);
    const googleBlocks: GoogleBlock[] = [
      {
        id: 'g1',
        summary: 'Standing meeting',
        start: toNaiveISOString(blockStart).slice(0, 19),
        end: toNaiveISOString(blockEnd).slice(0, 19),
      },
    ];

    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [morningWindow, afternoonWindow, sequentialFillRule],
      booked: [],
      googleBlocks,
    });

    // The afternoon window's frontier is seeded at its own 12:00 start,
    // unaffected by the morning window's Google block — its first slot
    // must be available even though the morning block's end (10:45) plus
    // the 30-minute gap (11:15) is well before 12:00.
    expect(slots.find((s) => s.start.slice(11, 16) === '12:00')?.available).toBe(true);
  });
});

describe('nextAvailableSlot', () => {
  it('returns the first available slot at or after the given time', () => {
    const day = new Date('2026-08-17T00:00:00');
    const slots = getAvailableSlots({
      startDate: day,
      endDate: day,
      reason,
      rules: [allDaysHours],
      booked: [],
      googleBlocks: [],
    });

    const after = new Date(day);
    after.setHours(9, 20, 0, 0);
    const next = nextAvailableSlot(slots, after);
    expect(next).toBeDefined();
    expect(new Date(next!.start).getTime()).toBeGreaterThanOrEqual(after.getTime());
  });
});
