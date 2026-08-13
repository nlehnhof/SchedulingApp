import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse } from '@/lib/error-response';
import { resolveClientLink } from '@/lib/resolve-client-link';

// The visitor link may be the client's raw UUID or (premium-only) a custom
// slug — resolveClientLink() is the one shared place that decides which,
// so every visitor route stays consistent (PLAN.md Section 4 feature 2 /
// Section 5).
export async function GET(
  _req: Request,
  { params }: { params: { clientLink: string } }
) {
  const resolved = await resolveClientLink(params.clientLink);
  if (!resolved) {
    return NextResponse.json({ error: 'This booking link is not valid.' }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: reasons, error } = await supabase
    .from('appointment_reasons')
    .select('id, name, duration_min')
    .eq('client_id', resolved.clientId)
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
