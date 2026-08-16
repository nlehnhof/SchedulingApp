import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { requireClient } from '@/lib/require-client';
import { getEffectiveTier } from '@/lib/premium-grants';
import { errorResponse } from '@/lib/error-response';

// Read-only, open to any authenticated client — same "any tier can see its
// own current billing state" pattern as GET /api/client/branding, so the
// billing page has something to render before the client has ever upgraded.
export async function GET() {
  const client = await requireClient();
  if (client instanceof NextResponse) return client;
  if (!client.clientId) {
    return NextResponse.json({ error: 'Only an account owner has billing to manage.' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('email, tier, stripe_customer_id, stripe_subscription_status')
    .eq('id', client.clientId)
    .single();

  if (error) return errorResponse(error, 'Could not load billing status.');

  // `tier` here is the effective tier (raw column or a live premium_grants
  // override, see lib/premium-grants.ts), so a comped account's Billing
  // page shows "Premium" like every other premium-gated page does, rather
  // than disagreeing with the rest of the dashboard. stripe_subscription_status
  // is left untouched — that's a straight mirror of Stripe's own state, not
  // something a grant should paper over.
  const tier = await getEffectiveTier(data.tier, data.email);
  return NextResponse.json({
    tier,
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_status: data.stripe_subscription_status,
  });
}
