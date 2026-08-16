// Real-Postgres concurrency test for book_appointment/update_appointment
// (supabase/migrations/0017_booking_functions_calendar_scoped.sql) — the
// anti-double-booking guarantee is a FOR UPDATE row-locking behavior that
// pure-function tests (lib/availability.test.ts) structurally cannot verify,
// since the whole point is what happens when N real transactions race each
// other. Runs against a LOCAL Supabase CLI stack, never a real project —
// deliberately reads TEST_SUPABASE_URL/TEST_SUPABASE_SERVICE_ROLE_KEY, not
// the app's own NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, so this
// can never accidentally fire concurrent booking spam at production data.
//
// Setup (one-time):
//   1. `npx supabase start` (requires Docker) — applies every migration in
//      supabase/migrations/ to a fresh local Postgres.
//   2. `npx supabase status` prints the local API URL + service_role key.
//      Put them in .env.test.local as TEST_SUPABASE_URL /
//      TEST_SUPABASE_SERVICE_ROLE_KEY (see .env.test.local.example).
//   3. `npm run test:integration`
//
// This suite is intentionally NOT part of `npm test` (see the separate
// `test:integration` script in package.json) — it needs a running local
// Postgres, unlike every other test in this repo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test.local' });

const TEST_URL = process.env.TEST_SUPABASE_URL;
const TEST_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const shouldRun = !!TEST_URL && !!TEST_KEY;

// describe.skipIf rather than throwing — running `npm run test:integration`
// without a local stack configured yet should explain itself, not crash.
describe.skipIf(!shouldRun)('booking concurrency (real Postgres)', () => {
  let supabase: SupabaseClient;
  let clientId: string;
  let calendarId: string;
  let reasonId: string;

  beforeAll(async () => {
    supabase = createClient(TEST_URL!, TEST_KEY!);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({ email: `concurrency-test-${Date.now()}@example.com` })
      .select('id')
      .single();
    if (clientError) throw clientError;
    clientId = client.id;

    const { data: calendar, error: calendarError } = await supabase
      .from('booking_calendars')
      .insert({ client_id: clientId, display_name: 'Concurrency Test Calendar' })
      .select('id')
      .single();
    if (calendarError) throw calendarError;
    calendarId = calendar.id;

    const { data: reason, error: reasonError } = await supabase
      .from('appointment_reasons')
      .insert({ calendar_id: calendarId, name: 'Test Reason', duration_min: 15, order: 1 })
      .select('id')
      .single();
    if (reasonError) throw reasonError;
    reasonId = reason.id;
  });

  afterAll(async () => {
    // FK cascades (ON DELETE CASCADE from clients -> booking_calendars ->
    // rules/appointment_reasons/appointments/error_log/csv_exports) mean
    // deleting the client row cleans up everything this test created.
    if (clientId) await supabase.from('clients').delete().eq('id', clientId);
  });

  it('book_appointment: exactly one of N concurrent requests for the same slot wins', async () => {
    const startTime = '2030-01-15T09:00:00';
    const attempts = 10;

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        supabase.rpc('book_appointment', {
          p_calendar_id: calendarId,
          p_visitor_name: `Visitor ${i}`,
          p_visitor_phone: '555-0100',
          p_reason_id: reasonId,
          p_start_time: startTime,
          p_visitor_email: `visitor${i}@example.com`,
        })
      )
    );

    const errors = results.filter((r) => r.error);
    expect(errors).toHaveLength(0);

    const statuses = results.map((r) => {
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return row?.result_status;
    });

    expect(statuses.filter((s) => s === 'booked')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'conflict')).toHaveLength(attempts - 1);

    // Second line of defense — the UNIQUE(calendar_id, start_time, end_time)
    // constraint (0016 migration) — should mean exactly one row landed too,
    // not just that the RPC reported one winner.
    const { data: appointments, error: countError } = await supabase
      .from('appointments')
      .select('id')
      .eq('calendar_id', calendarId)
      .eq('start_time', startTime);
    if (countError) throw countError;
    expect(appointments).toHaveLength(1);
  });

  it('update_appointment: concurrent reschedules onto the same slot also serialize to one winner', async () => {
    // Two appointments booked at distinct times, then both concurrently
    // rescheduled onto the identical new slot — exactly one edit should
    // succeed, the other should report a conflict rather than silently
    // double-booking.
    const bookA = await supabase.rpc('book_appointment', {
      p_calendar_id: calendarId,
      p_visitor_name: 'Reschedule A',
      p_visitor_phone: '555-0101',
      p_reason_id: reasonId,
      p_start_time: '2030-01-16T09:00:00',
      p_visitor_email: 'a@example.com',
    });
    const bookB = await supabase.rpc('book_appointment', {
      p_calendar_id: calendarId,
      p_visitor_name: 'Reschedule B',
      p_visitor_phone: '555-0102',
      p_reason_id: reasonId,
      p_start_time: '2030-01-16T10:00:00',
      p_visitor_email: 'b@example.com',
    });
    const appointmentAId = (Array.isArray(bookA.data) ? bookA.data[0] : bookA.data)?.appointment_id;
    const appointmentBId = (Array.isArray(bookB.data) ? bookB.data[0] : bookB.data)?.appointment_id;
    expect(appointmentAId).toBeTruthy();
    expect(appointmentBId).toBeTruthy();

    const targetTime = '2030-01-16T14:00:00';
    const [editA, editB] = await Promise.all([
      supabase.rpc('update_appointment', {
        p_appointment_id: appointmentAId,
        p_calendar_id: calendarId,
        p_visitor_name: 'Reschedule A',
        p_visitor_phone: '555-0101',
        p_reason_id: reasonId,
        p_start_time: targetTime,
      }),
      supabase.rpc('update_appointment', {
        p_appointment_id: appointmentBId,
        p_calendar_id: calendarId,
        p_visitor_name: 'Reschedule B',
        p_visitor_phone: '555-0102',
        p_reason_id: reasonId,
        p_start_time: targetTime,
      }),
    ]);

    expect(editA.error).toBeNull();
    expect(editB.error).toBeNull();
    const statusA = (Array.isArray(editA.data) ? editA.data[0] : editA.data)?.result_status;
    const statusB = (Array.isArray(editB.data) ? editB.data[0] : editB.data)?.result_status;
    const statuses = [statusA, statusB];

    expect(statuses.filter((s) => s === 'updated')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'conflict')).toHaveLength(1);
  });
});
