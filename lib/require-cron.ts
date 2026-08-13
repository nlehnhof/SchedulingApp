import { NextResponse } from 'next/server';

/**
 * Internal endpoints (/api/cron/*) aren't behind NextAuth — they're hit by
 * Render's cron scheduler, not a browser. Guard them with a shared secret
 * header instead so they can't be triggered by anyone who finds the URL.
 */
export function requireCron(req: Request): NextResponse | null {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
