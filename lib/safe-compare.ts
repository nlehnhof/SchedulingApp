import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison — used for the admin login password and
 * the CRON_SECRET header check, so a network-observable timing difference
 * can't leak how many leading characters of a guess were correct. A plain
 * `===` short-circuits on the first mismatched byte, which is a real (if
 * hard-to-exploit-remotely) side channel for anything gating access.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch rather than returning false,
  // so check that first. This length check is itself not constant-time,
  // but leaking the *length* of the correct secret (not its content) is an
  // acceptable, standard trade-off for this pattern.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
