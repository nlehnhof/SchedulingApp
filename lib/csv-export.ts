import { createServiceClient } from './supabase';
import { sendEmail } from './email';

export function csvEscape(value: string): string {
  // Formula-injection (aka "CSV injection") guard: Excel/Sheets treat a
  // cell starting with =, +, -, or @ as a formula to evaluate. Visitor-
  // supplied fields (name, phone, notes) flow into this file unsanitized
  // otherwise, so a malicious visitor name like `=HYPERLINK("http://evil")`
  // would execute when the client opens the export. Prepending a single
  // quote is the standard mitigation (OWASP CSV Injection cheat sheet) —
  // spreadsheet apps treat it as "force text" rather than showing a stray
  // character in the cell.
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates the previous/target month's appointment CSV for one booking
 * calendar, emails it to the owning client, and records the export. Mirrors
 * SCHEDULING_APP_ORCHESTRATION.md Phase 2 "CSV Export". One export per
 * calendar, not per client — a client with several calendars gets a
 * separate email per calendar, same as everything else calendar-scoped.
 *
 * @param month "YYYY-MM"
 */
export async function exportMonthlyCSV(calendarId: string, month: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: calendar } = await supabase
    .from('booking_calendars')
    .select('id, display_name, clients(email)')
    .eq('id', calendarId)
    .single();
  if (!calendar) throw new Error(`Calendar ${calendarId} not found`);
  const owner: any = Array.isArray((calendar as any).clients)
    ? (calendar as any).clients[0]
    : (calendar as any).clients;
  if (!owner) throw new Error(`Calendar ${calendarId} has no owning client`);

  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, appointment_reasons(name)')
    .eq('calendar_id', calendarId)
    .gte('start_time', monthStart.toISOString())
    .lt('start_time', monthEnd.toISOString());

  const rows = [
    ['Visitor Name', 'Phone', 'Reason', 'Start Time', 'End Time', 'Notes', 'Status'],
    ...(appointments ?? []).map((apt: any) => [
      apt.visitor_name,
      apt.visitor_phone,
      apt.appointment_reasons?.name ?? apt.reason_id,
      apt.start_time,
      apt.end_time,
      apt.notes ?? '',
      apt.status,
    ]),
  ];

  const csvContent = rows.map((row) => row.map((v) => csvEscape(String(v))).join(',')).join('\n');

  const label = calendar.display_name ? ` – ${calendar.display_name}` : '';
  await sendEmail({
    to: owner.email,
    subject: `Scheduling App – Appointments Export (${month})${label}`,
    text: csvContent,
  });

  await supabase
    .from('csv_exports')
    .upsert(
      { calendar_id: calendarId, month: `${month}-01`, emailed_at: new Date().toISOString() },
      { onConflict: 'calendar_id,month' }
    );
}

/** Runs the monthly export for every booking calendar. Used by the cron job on the 1st of the month. */
export async function exportMonthlyCSVForAllClients(month: string): Promise<{ exported: number }> {
  const supabase = createServiceClient();
  const { data: calendars } = await supabase.from('booking_calendars').select('id');
  let exported = 0;
  for (const calendar of calendars ?? []) {
    await exportMonthlyCSV(calendar.id, month);
    exported++;
  }
  return { exported };
}
