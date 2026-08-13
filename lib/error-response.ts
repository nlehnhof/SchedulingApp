import { NextResponse } from 'next/server';

/**
 * Logs the real error server-side (still visible in Render's logs) and
 * returns a generic, client-safe message instead of leaking raw
 * Postgres/Supabase error text — column names, constraint names, internal
 * detail — to whoever called the route. That mattered most for
 * visitor-facing routes (an anonymous visitor could see internal DB errors
 * on a failed booking), but applied everywhere for consistency.
 */
export function errorResponse(err: unknown, fallbackMessage: string, status = 500): NextResponse {
  console.error(fallbackMessage, err);
  return NextResponse.json({ error: fallbackMessage }, { status });
}
