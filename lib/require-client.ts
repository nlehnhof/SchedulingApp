import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';

/**
 * Resolves the authenticated client's ID from the NextAuth session, or
 * returns a 401 NextResponse to short-circuit the route handler.
 *
 * Usage:
 *   const client = await requireClient();
 *   if (client instanceof NextResponse) return client;
 *   // client.clientId is now a string
 */
export async function requireClient(): Promise<{ clientId: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const clientId = (session as any)?.clientId;
  if (!clientId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return { clientId };
}
