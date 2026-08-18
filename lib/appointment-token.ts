import { createHmac } from 'crypto';
import { safeCompare } from './safe-compare';

/**
 * Stateless, single-appointment management link (L7 launch phase). No new
 * table, no expiry beyond the appointment's own start time — an HMAC over
 * the appointment id is either valid or it isn't; there's nothing to revoke
 * or garbage-collect. Same shape as lib/require-cron.ts's shared-secret
 * check: recompute the expected signature and compare with
 * lib/safe-compare.ts's constant-time compare, never `===`, so a tampered
 * token can't be narrowed down byte by byte via response timing.
 */
function secret(): string {
  const s = process.env.APPOINTMENT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) {
    throw new Error(
      'APPOINTMENT_TOKEN_SECRET or NEXTAUTH_SECRET must be set to sign appointment management links.'
    );
  }
  return s;
}

function signature(appointmentId: string): string {
  return createHmac('sha256', secret()).update(appointmentId).digest('hex');
}

export function createAppointmentToken(appointmentId: string): string {
  return `${appointmentId}.${signature(appointmentId)}`;
}

/** Returns the appointment id if the token is genuine, null otherwise (bad shape or bad signature). */
export function verifyAppointmentToken(token: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const appointmentId = token.slice(0, dot);
  const providedSignature = token.slice(dot + 1);
  if (!providedSignature) return null;
  if (!safeCompare(providedSignature, signature(appointmentId))) return null;
  return appointmentId;
}
