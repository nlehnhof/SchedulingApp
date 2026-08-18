import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';

export const metadata: Metadata = {
  title: 'Gather Terms of Service',
  description: 'The terms that govern use of the Gather scheduling application.',
};

const UPDATED = 'August 17, 2026';

export default function TermsPage() {
  return (
    <main className="min-h-[100dvh] bg-canvas">
      <MarketingNav />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
        <h1 className="font-display text-display-lg text-text">Terms of Service</h1>
        <p className="mt-2 text-body-sm text-text-2">Last updated {UPDATED}</p>

        <div className="mt-10 flex flex-col gap-10">
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">The service</h2>
            <p className="text-body text-text-2">
              Gather is a rule-based appointment scheduling application. A client sets up
              availability rules and shares a booking link; visitors use that link to book
              appointments against the client&apos;s open hours. Gather is provided on an &quot;as
              is&quot; and &quot;as available&quot; basis, without warranties of any kind, express
              or implied.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Acceptable use</h2>
            <p className="text-body text-text-2">
              You agree not to use Gather to collect data unlawfully, to harass or deceive
              visitors, to interfere with the operation of the service, or to attempt to gain
              unauthorized access to another client&apos;s account or calendar.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Responsibility for visitor data</h2>
            <p className="text-body text-text-2">
              As a client, you are responsible for the data you collect from your own visitors
              through Gather, and for how you use it. You&apos;re responsible for having any
              consent or legal basis your own use requires, and for complying with laws that
              apply to your business or organization.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Subscriptions and billing</h2>
            <p className="text-body text-text-2">
              Paid plans are billed monthly in advance and renew automatically until cancelled.
              You can cancel at any time from your billing page; cancellation takes effect at the
              end of the current billing period, and your plan reverts to Free at that point. We
              do not provide refunds for partial months. Where a free trial is offered, you will
              not be charged until the trial ends, and you can cancel before then at no cost.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Google Calendar access</h2>
            <p className="text-body text-text-2">
              If you connect a Google Calendar, you authorize Gather to read that calendar for
              busy time and to create, update, and delete events representing appointments booked
              through Gather. You can revoke this access at any time from your dashboard or
              directly from your Google Account settings.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Termination</h2>
            <p className="text-body text-text-2">
              You may stop using Gather and delete your account at any time. We may suspend or
              terminate access to the service for a client who violates these terms or misuses
              the service. On termination, your data is deleted as described in the{' '}
              <a href="/privacy" className="text-lume underline underline-offset-2">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Changes to these terms</h2>
            <p className="text-body text-text-2">
              If these terms change in a material way, we&apos;ll update the date at the top of
              this page. Continued use of Gather after a change means you accept the updated
              terms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Contact</h2>
            <p className="text-body text-text-2">
              Questions about these terms? Reach us at{' '}
              <a href="mailto:support@gathertime.com" className="text-lume underline underline-offset-2">
                support@gathertime.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
