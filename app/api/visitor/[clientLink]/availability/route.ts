import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getAvailableSlots } from '@/lib/availability';
import type { Appointment, AppointmentReason, Rule } from '@/lib/types';

export async function GET(
  req: Request,
  { params }: { params: { clientLink: string } }
) {
  const clientId = params.clientLink;
  const { searchParams } = new URL(req.url);
  const reasonId = searchParams.get('reasonId');
  if (!reasonId) {
    return NextResponse.json({ error: 'reasonId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [{ data: client }, { data: reason }, { data: rules }, { data: booked }] =
    await Promise.all([
      supabase.from('clients').select('id, email').eq('id', clientId).maybeSingle(),
      supabase
        .from('appointment_reasons')
        .select('*')
        .eq('id', reasonId)
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase.from('rules').select('*').eq('client_id', clientId),
      supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .gt('expires_at', new Date().toISOString()),
    ]);

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!reason) return NextResponse.json({ error: 'Reason not found' }, { status: 404 });

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // "next 30 days" per orchestration doc

  const slots = getAvailableSlots({
    startDate,
    endDate,
    reason: reason as AppointmentReason,
    rules: (rules ?? []) as Rule[],
    booked: (booked ?? []) as Appointment[],
    googleBlocks: [], // Google blocks are enforced by the cron sync (red_flag) + booking fn;
    // omitted here to avoid a live Google API round-trip on every visitor page load.
  });

  return NextResponse.json({
    clientName: client.email,
    slots: slots
      .filter((s) => s.available)
      .map((s) => ({
        date: s.start.slice(0, 10),
        time: s.start.slice(11, 16),
        start: s.start, // full ISO, needed by the booking request
        end: s.end,
        reason: reason.name,
      })),
  });
}
