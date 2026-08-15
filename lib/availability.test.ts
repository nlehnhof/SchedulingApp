import { describe, expect, it } from 'vitest';
import { getAvailableSlots, nextAvailableSlot } from './availability';
import type { Appointment, AppointmentReason, Rule } from './types';

const reason: AppointmentReason = {
  id: 'reason-1',
  client_id: 'client-1',
  name: 'Recommend',
  duration_min: 15,
  order: 1,
};

const allDaysHours: Rule = {
  id: 'rule-hours',
  client_id: 'client-1',
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
    client_id: 'client-1',
    visitor_name: 'Jane',
    visitor_phone: '555-1234',
    visitor_email: 'jane@example.com',
    reason_id: reason.id,
    start_time: startISO,
    end_time: endISO,
    notes: null,
    status: 'confirmed',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
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
      client_id: 'client-1',
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
      client_id: 'client-1',
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

  it('generates no slots on a blacked-out day', () => {
    const day = new Date('2026-08-17T00:00:00'); // Monday
    const blackoutRule: Rule = {
      id: 'rule-blackout',
      client_id: 'client-1',
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
      client_id: 'client-1',
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
      client_id: 'client-1',
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
      client_id: 'client-1',
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
