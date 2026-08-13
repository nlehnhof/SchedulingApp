import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { reasonSchema } from '@/lib/validation';
import { errorResponse } from '@/lib/error-response';

export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('appointment_reasons')
    .select('*')
    .eq('client_id', client.clientId)
    .order('order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reasons: data });
}

// Create-only. Previously this upserted on `onConflict: 'client_id,name'`,
// which meant `name` was effectively a primary key — there was no way to
// rename a reason without silently creating a new row, and no way to
// delete one at all (see PLAN.md Section 1). Renames/duration/order edits
// now go through PATCH /api/client/reasons/[id] (by id, not by name); this
// route only ever inserts, and rejects a duplicate name up front instead
// of letting the DB's UNIQUE(client_id, name) constraint surface a raw
// Postgres error.
export async function POST(req: Request) {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;

  const parsed = reasonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('appointment_reasons')
    .select('id')
    .eq('client_id', client.clientId)
    .eq('name', body.name)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'A reason with this name already exists.' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('appointment_reasons')
    .insert({
      client_id: client.clientId,
      name: body.name,
      duration_min: body.durationMin,
      order: body.order ?? 0,
    })
    .select()
    .single();

  if (error) {
    // The existence check above closes most cases, but two concurrent
    // creates with the same name can both pass it before either inserts —
    // fall back on the UNIQUE(client_id, name) constraint itself so a
    // narrow double-submit still gets a friendly 409 instead of a generic
    // 500 (same pattern as PATCH /api/client/reasons/[id]).
    if ((error as any).code === '23505') {
      return errorResponse(error, 'A reason with this name already exists.', 409);
    }
    return errorResponse(error, 'Could not save reason.');
  }
  return NextResponse.json({
    reasonId: data.id,
    name: data.name,
    durationMin: data.duration_min,
  });
}
