import { createServiceClient } from './supabase';
import { getAvailableSlots, nextAvailableSlot } from './availability';
import type { Appointment, AppointmentReason, BookingResult, GoogleBlock, Rule } from './types';

export interface BookAppointmentInput {
  clientId: string;
  visitorName: string;
  visitorPhone: string;
  reasonId: string;
  startTime: string; // ISO
  notes?: string;
}

/**
 * Books an appointment via the `book_appointment` Postgres function, which
 * handles locking + conflict detection atomically (see
 * supabase/migrations/0002_booking_function.sql). On conflict, falls back to
 * the availability calculator to suggest the next open slot for the same
 * reason.
 */
export async function bookAppointment(input: BookAppointmentInput): Promise<BookingResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('book_appointment', {
    p_client_id: input.clientId,
    p_visitor_name: input.visitorName,
    p_visitor_phone: input.visitorPhone,
    p_reason_id: input.reasonId,
    p_start_time: input.startTime,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  if (row?.result_status === 'booked') {
    return {
      status: 'booked',
      appointment: {
        id: row.appointment_id,
        start: row.result_start,
        end: row.result_end,
      },
    };
  }

  // Conflict: suggest the next available slot for this reason.
  const [{ data: reason }, { data: rules }, { data: booked }] = await Promise.all([
    supabase
      .from('appointment_reasons')
      .select('*')
      .eq('id', input.reasonId)
      .single(),
    supabase.from('rules').select('*').eq('client_id', input.clientId),
    supabase
      .from('appointments')
      .select('*')
      .eq('client_id', input.clientId)
      .gt('expires_at', new Date().toISOString()),
  ]);

  let nextAvailable;
  if (reason) {
    const searchStart = new Date(input.startTime);
    const searchEnd = new Date(searchStart);
    searchEnd.setDate(searchEnd.getDate() + 30);

    const slots = getAvailableSlots({
      startDate: searchStart,
      endDate: searchEnd,
      reason: reason as AppointmentReason,
      rules: (rules ?? []) as Rule[],
      booked: (booked ?? []) as Appointment[],
      googleBlocks: [] as GoogleBlock[], // best-effort; caller may re-check against live calendar
    });
    nextAvailable = nextAvailableSlot(slots, searchStart);
  }

  return {
    status: 'conflict',
    message: 'That slot just booked! Try this instead?',
    nextAvailable,
  };
}
