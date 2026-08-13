/**
 * SMS provider wrapper for premium feature 3 (appointment reminders,
 * PLAN.md Section 4 feature 3) — DELIBERATELY NOT WIRED to a real provider.
 *
 * This deployment has no Twilio-or-equivalent credentials available in
 * this environment, and PLAN.md explicitly permits deferring this feature
 * rather than shipping a fabricated integration that can't be verified
 * end-to-end. `sendSms()` below always throws: it never silently no-ops
 * and never pretends to succeed. The cron route that calls it
 * (app/api/cron/sms-reminders/route.ts) treats that as an expected,
 * caught, per-appointment failure.
 *
 * To make this real: install the chosen provider's SDK, implement
 * `sendSms` below (mirrors lib/email.ts's lazy-client pattern so importing
 * this module never throws just because env vars aren't set yet — see
 * lib/email.ts's comment on why), and set TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER (or the equivalent for whichever
 * provider is chosen) in the deployment environment. No other file needs
 * to change — the cron route only ever calls sendSms()/isSmsConfigured().
 */

export class SmsNotConfiguredError extends Error {
  constructor() {
    super('SMS provider is not configured (missing TWILIO_* env vars).');
    this.name = 'SmsNotConfiguredError';
  }
}

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<void> {
  if (!isSmsConfigured()) {
    throw new SmsNotConfiguredError();
  }
  // Not implemented — see file header. Intentionally throws even when the
  // env vars above happen to be set, since there is no real provider call
  // wired up yet; flipping isSmsConfigured() to true without implementing
  // this would silently claim success on every reminder.
  void to;
  void body;
  throw new Error('sendSms() has no provider implementation yet — see lib/sms.ts header comment.');
}
