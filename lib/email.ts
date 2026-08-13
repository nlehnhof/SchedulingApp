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
}: {
  to: string;
  subject: string;
  text: string;
}) {
  return getResendClient().emails.send({
    from: 'Scheduling App <noreply@yourdomain.com>',
    to,
    subject,
    text,
  });
}
