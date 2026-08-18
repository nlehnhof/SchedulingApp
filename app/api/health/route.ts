import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// L8 launch phase — point an uptime monitor here. No auth (nothing secret in
// the body), nodejs runtime (needs the service-role Supabase client, same as
// every other server route). Fails non-200 when the database is unreachable,
// since that's the outage that actually happens on a Render Starter
// instance — a dead process would already fail to respond at all.
export const runtime = 'nodejs';

export async function GET() {
  const supabase = createServiceClient();
  const { error } = await supabase.from('clients').select('id').limit(1);

  const checks = { db: !error };
  if (error) {
    return NextResponse.json({ ok: false, commit: process.env.RENDER_GIT_COMMIT ?? null, checks }, { status: 503 });
  }

  return NextResponse.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT ?? null, checks });
}
