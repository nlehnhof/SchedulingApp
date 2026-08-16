import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { errorResponse } from '@/lib/error-response';

// Marks the first-run tour as seen (PLAN.md Section 3). Called both when
// the client actually finishes the tour and when they skip/dismiss it —
// server-side, those are indistinguishable and don't need to be: the only
// thing that matters is "stop showing this unprompted." Replaying the tour
// via the nav's "Replay tutorial" button does NOT call this route, so a
// manual replay never re-touches tutorial_completed_at.
export async function POST() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    // A pure collaborator has no tutorial/onboarding state of their own —
    // nothing to do, but not an error either.
    return NextResponse.json({ status: 'ok' });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('clients')
    .update({ tutorial_completed_at: new Date().toISOString() })
    .eq('id', client.clientId);

  if (error) return errorResponse(error, 'Could not save tutorial progress.');
  return NextResponse.json({ status: 'ok' });
}
