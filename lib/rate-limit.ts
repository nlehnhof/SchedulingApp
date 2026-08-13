/**
 * Minimal in-memory sliding-window rate limiter. Good enough as a first
 * line of defense on a single-instance deployment (Render Starter runs
 * WEB_CONCURRENCY=1) against brute-forcing the admin login or hammering the
 * visitor booking endpoint.
 *
 * Known limitation: this resets on every deploy/restart and doesn't
 * coordinate across multiple instances. If this app ever scales to more
 * than one Render instance, swap this for a shared store (e.g. Upstash
 * Redis) — right now every instance would track its own counts, which
 * effectively multiplies the real limit by the instance count.
 */
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  return hits.length > limit;
}

/** Best-effort caller IP from the standard proxy header Render sets. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
