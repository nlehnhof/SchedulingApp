import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getAvailableSlots } from '@/lib/availability';
import type { Appointment, AppointmentReason, Rule } from '@/lib/types';

export async function GET(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const reasonId = searchParams.get('reasonId');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [{ data: rules }, { data: booked }, { data: reasons }] = await Promise.all([
    supabase.from('rules').select('*').eq('client_id', client.clientId),
    supabase
      .from('appointments')
      .select('*')
      .eq('client_id', client.clientId)
      .gt('expires_at', new Date().toISOString()),
    reasonId
      ? supabase.from('appointment_reasons').select('*').eq('id', reasonId)
      : supabase.from('appointment_reasons').select('*').eq('client_id', client.clientId).limit(1),
  ]);

  const reason = reasons?.[0] as AppointmentReason | undefined;
  if (!reason) {
    return NextResponse.json({ error: 'No appointment reason found' }, { status: 400 });
  }

  const slots = getAvailableSlots({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    reason,
    rules: (rules ?? []) as Rule[],
    booked: (booked ?? []) as Appointment[],
    googleBlocks: [],
  });

  // Group flat slots + booked appointments into per-day buckets for the
  // calendar view (Phase 3: "Click date → see available slots + booked
  // appointments", color-coded by status).
  const days = new Map<string, { slots: typeof slots; appointments: Appointment[] }>();
  for (const slot of slots) {
    const day = slot.start.slice(0, 10);
    if (!days.has(day)) days.set(day, { slots: [], appointments: [] });
    days.get(day)!.slots.push(slot);
  }
  for (const apt of (booked ?? []) as Appointment[]) {
    const day = apt.start_time.slice(0, 10);
    if (!days.has(day)) days.set(day, { slots: [], appointments: [] });
    days.get(day)!.appointments.push(apt);
  }

  return NextResponse.json({
    days: Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({ date, ...bucket })),
  });
}
