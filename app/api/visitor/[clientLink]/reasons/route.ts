import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse } from '@/lib/error-response';

// The visitor link is the client's UUID for now (Constraints: "link-scoped, can't
// see other clients"). Swap to a dedicated short slug column later if a
// friendlier URL is wanted — the lookup here is the only place that'd change.
export async function GET(
  _req: Request,
  { params }: { params: { clientLink: string } }
) {
  const supabase = createServiceClient();
  const { data: reasons, error } = await supabase
    .from('appointment_reasons')
    .select('id, name, duration_min')
    .eq('client_id', params.clientLink)
    .order('order', { ascending: true });

  if (error) return errorResponse(error, 'Could not load booking options.');
  return NextResponse.json({
    reasons: (reasons ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      durationMin: r.duration_min,
    })),
  });
}
