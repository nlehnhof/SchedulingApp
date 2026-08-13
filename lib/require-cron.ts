import { NextResponse } from 'next/server';
import { safeCompare } from './safe-compare';

/**
 * Internal endpoints (/api/cron/*) aren't behind NextAuth — they're hit by
 * Render's cron scheduler, not a browser. Guard them with a shared secret
 * header instead so they can't be triggered by anyone who finds the URL.
 * Uses a constant-time comparison rather than `!==` so a timing side
 * channel can't help an attacker narrow down the secret byte by byte.
 */
export function requireCron(req: Request): NextResponse | null {
  const secret = req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected || !secret || !safeCompare(secret, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
