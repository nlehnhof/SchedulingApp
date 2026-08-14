import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse } from '@/lib/error-response';

// Dev-only tier toggle: lets the admin test account (ALLOW_ADMIN_LOGIN)
// flip itself between free/premium so premium features can actually be
// clicked through without a direct DB edit. Locked down two ways, both
// independent of anything a caller can influence:
//  1. 404s entirely unless ALLOW_ADMIN_LOGIN=true — same "doesn't exist in
//     prod" posture as the admin credentials provider itself (lib/auth.ts).
//  2. Even then, only the session whose email matches ADMIN_EMAIL can use
//     it. A real Google-OAuth client can never reach this — tier is
//     otherwise never writable from any client-facing route (see PLAN.md
//     Section 5 / REVIEW.md's "tier is never accepted as client input"
//     finding); this route is the one deliberate, tightly-scoped exception,
//     for testing only.
export async function POST() {
  if (process.env.ALLOW_ADMIN_LOGIN !== 'true') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const clientId = (session as any)?.clientId;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.test';
  if (!clientId || session?.user?.email !== adminEmail) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const currentTier: 'free' | 'premium' = (session as any)?.tier === 'premium' ? 'premium' : 'free';
  const nextTier: 'free' | 'premium' = currentTier === 'premium' ? 'free' : 'premium';

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .update({ tier: nextTier })
    .eq('id', clientId)
    .select('tier')
    .single();

  if (error) return errorResponse(error, 'Could not toggle tier.');
  return NextResponse.json({ tier: data.tier });
}
