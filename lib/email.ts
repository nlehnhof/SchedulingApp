import { Resend } from 'resend';

// Constructed lazily (not at module scope) so importing this module never throws just
// because RESEND_API_KEY isn't set yet — e.g. during `next build`'s page-data collection,
// which imports every route module including this one via the cron export route.
let resend: Resend | null = null;
function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail({
  to,
  subject,
  text,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  // Display name shown as the sender (e.g. a client's business name) — the
  // sending address itself always stays on the verified domain below, since
  // an arbitrary From address can't be made to deliver reliably (SPF/DKIM
  // are tied to the domain, not the display name) without owning that
  // domain's DNS. replyTo is what actually routes a visitor's reply to the
  // client, without needing to spoof From.
  fromName?: string;
  replyTo?: string;
}) {
  // EMAIL_FROM_ADDRESS is the one thing an operator sets once for the whole
  // platform (a Resend-verified domain) — never per client. Individual
  // premium clients configure nothing here; see the header comment on
  // sendBookingConfirmationEmail for why a shared sending address, not a
  // per-client one, is the only workable design without asking every client
  // to verify their own domain's DNS.
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
  const result = await getResendClient().emails.send({
    from: `${fromName ?? 'Scheduling App'} <${fromAddress}>`,
    to,
    subject,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  // The Resend SDK does not throw on an API-level rejection (unverified
  // domain, invalid recipient, etc.) — it resolves with { data: null, error
  // }. Callers (e.g. lib/booking.ts's confirmation-email try/catch) rely on
  // this throwing to detect and log a real failure, so surface it here
  // rather than letting a rejected send look like a success.
  if (result.error) {
    throw new Error(`Resend rejected the email: ${result.error.message ?? JSON.stringify(result.error)}`);
  }
  return result;
}

/**
 * Premium-tier booking confirmation, sent to the visitor right after a
 * successful booking. Not a real From-address spoof — see sendEmail's note —
 * but reads as coming from the client: their business name as the sender
 * name, and replies go straight to their inbox via replyTo.
 *
 * CLIENT SETUP REQUIRED: none. This is fully automatic — a premium client
 * does nothing to "turn on" confirmation emails beyond being premium; there
 * is no per-client email address, domain, or template to configure anywhere
 * in the dashboard. That's a deliberate design choice, not a missing
 * feature: letting each client send from their *own* domain would require
 * every client to add DNS records (SPF/DKIM/CNAME) and wait for Resend to
 * verify them — real technical setup this app's target user (someone who
 * wants a booking page, not an email deliverability project) shouldn't have
 * to do. Instead every client shares the one sending address the app
 * operator configures (EMAIL_FROM_ADDRESS, see sendEmail below); the
 * client's own identity shows up as the display name and reply-to instead.
 *
 * OPERATOR SETUP REQUIRED (one time, for the whole app, not per client):
 * verify a real domain in the Resend dashboard and set EMAIL_FROM_ADDRESS
 * to an address on it (e.g. bookings@yourdomain.com). Until that's done,
 * Resend runs in sandbox mode and silently restricts delivery to the
 * account owner's own test address regardless of who the app tries to
 * email — see the error_log entries this produces (error_type
 * 'booking_confirmation_email_failed') for the exact rejection reason.
 */
export async function sendBookingConfirmationEmail({
  visitorEmail,
  visitorName,
  clientDisplayName,
  clientEmail,
  reasonName,
  start,
  end,
}: {
  visitorEmail: string;
  visitorName: string;
  clientDisplayName: string;
  clientEmail: string;
  reasonName: string;
  start: Date;
  end: Date;
}) {
  const fmt = (d: Date) =>
    d.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

  await sendEmail({
    to: visitorEmail,
    subject: `Appointment confirmed with ${clientDisplayName}`,
    text: [
      `Hi ${visitorName},`,
      '',
      `Your appointment with ${clientDisplayName} is confirmed:`,
      '',
      reasonName,
      `${fmt(start)} – ${fmt(end)}`,
      '',
      `Questions? Just reply to this email — it goes straight to ${clientDisplayName}.`,
    ].join('\n'),
    fromName: clientDisplayName,
    replyTo: clientEmail,
  });
}
