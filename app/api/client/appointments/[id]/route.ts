import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { appointmentEditSchema } from '@/lib/validation';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = appointmentEditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('update_appointment', {
    p_appointment_id: params.id,
    p_client_id: client.clientId,
    p_visitor_name: body.visitorName,
    p_visitor_phone: body.visitorPhone,
    p_reason_id: body.reasonId,
    p_start_time: body.startTime,
    p_notes: body.notes ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.result_status === 'conflict') {
    return NextResponse.json(
      { status: 'conflict', message: 'That time overlaps another appointment.' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    status: 'updated',
    appointment: { id: row.appointment_id, start: row.result_start, end: row.result_end },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { error, count } = await supabase
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('client_id', client.clientId); // scope to this client, no cross-tenant deletes

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ status: 'deleted' });
}
