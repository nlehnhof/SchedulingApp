import { createServiceClient } from './supabase';
import { sendEmail } from './email';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates the previous/target month's appointment CSV for one client,
 * emails it via Resend, and records the export. Mirrors
 * SCHEDULING_APP_ORCHESTRATION.md Phase 2 "CSV Export".
 *
 * @param month "YYYY-MM"
 */
export async function exportMonthlyCSV(clientId: string, month: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, email')
    .eq('id', clientId)
    .single();
  if (!client) throw new Error(`Client ${clientId} not found`);

  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, appointment_reasons(name)')
    .eq('client_id', clientId)
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

  await sendEmail({
    to: client.email,
    subject: `Scheduling App – Appointments Export (${month})`,
    text: csvContent,
  });

  await supabase
    .from('csv_exports')
    .upsert(
      { client_id: clientId, month: `${month}-01`, emailed_at: new Date().toISOString() },
      { onConflict: 'client_id,month' }
    );
}

/** Runs the monthly export for every client. Used by the cron job on the 1st of the month. */
export async function exportMonthlyCSVForAllClients(month: string): Promise<{ exported: number }> {
  const supabase = createServiceClient();
  const { data: clients } = await supabase.from('clients').select('id');
  let exported = 0;
  for (const client of clients ?? []) {
    await exportMonthlyCSV(client.id, month);
    exported++;
  }
  return { exported };
}
