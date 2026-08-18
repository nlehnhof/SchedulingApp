import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';

export const metadata: Metadata = {
  title: 'Gather Privacy Policy',
  description: 'How Gather collects, uses, and protects data for clients and their visitors.',
};

const UPDATED = 'August 17, 2026';

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-canvas">
      <MarketingNav />
      <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
        <h1 className="font-display text-display-lg text-text">Privacy Policy</h1>
        <p className="mt-2 text-body-sm text-text-2">Last updated {UPDATED}</p>

        <div className="mt-10 flex flex-col gap-10">
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">What Gather is</h2>
            <p className="text-body text-text-2">
              Gather is a rule-based appointment scheduling tool. A client (the person paying
              for the product) sets up availability rules, and their visitors book appointments
              through a link the client shares. This policy explains what data we collect from
              clients and from visitors, and what we do with it.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Account data (clients)</h2>
            <p className="text-body text-text-2">
              When you sign in with Google, we store your email address, your name, and your
              Google profile as returned by OAuth. If you connect a Google Calendar, we store a
              refresh token so Gather can poll that calendar for busy time and write appointment
              events to it on your behalf.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Google Calendar data</h2>
            <p className="text-body text-text-2">
              Gather only reads the single calendar you select in your dashboard, over a rolling
              window of roughly thirty days, to determine which times are already busy. It writes
              one calendar event per appointment booked through Gather, and updates or deletes
              that event if the appointment changes. Gather does not read any other calendar on
              your Google account.
            </p>
            <p className="text-body text-text-2">
              Gather does not sell or transfer Google user data to third parties, does not use
              Google user data for advertising, and does not use Google user data to train
              generalized artificial-intelligence or machine-learning models. Google Calendar
              data is used only to power the availability and booking features described above.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Visitor data</h2>
            <p className="text-body text-text-2">
              A person booking an appointment through a client&apos;s link provides a name and
              phone number, and optionally an email address. This information is collected on
              behalf of the client whose link was used, so the client can identify and reach the
              person who booked. It is retained until the client deletes the appointment, or
              until the client deletes their account.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Who else sees this data</h2>
            <p className="text-body text-text-2">
              Gather relies on a small set of named service providers to operate, each limited to
              the role listed:
            </p>
            <ul className="flex flex-col gap-2 text-body text-text-2">
              <li>
                <span className="font-medium text-text">Supabase:</span> our database and the
                infrastructure that hosts it.
              </li>
              <li>
                <span className="font-medium text-text">Render:</span> hosts the Gather
                application itself.
              </li>
              <li>
                <span className="font-medium text-text">Resend:</span> sends transactional email,
                such as booking confirmations.
              </li>
              <li>
                <span className="font-medium text-text">Stripe:</span> processes subscription
                payments. Gather never stores your card number.
              </li>
              <li>
                <span className="font-medium text-text">Google:</span> provides sign-in and
                calendar sync, as described above.
              </li>
              <li>
                <span className="font-medium text-text">Sentry:</span> error monitoring, so we
                can find and fix problems in the application. Visitor names, phone numbers, and
                email addresses are stripped before any error report is sent.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Deleting your data</h2>
            <p className="text-body text-text-2">
              A client can delete their account at any time from the billing page of their
              dashboard. Deleting an account cancels any active subscription, revokes Gather&apos;s
              access to your Google Calendar, and removes your account and everything tied to it,
              including your rules, reasons, appointments, and error history, from our database.
              This also deactivates the client&apos;s public booking link immediately.
            </p>
            <p className="text-body text-text-2">
              To request deletion, or to ask any question about your data, contact us at{' '}
              <a href="mailto:support@gathertime.com" className="text-lume underline underline-offset-2">
                support@gathertime.com
              </a>
              .
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-display-sm text-text">Changes to this policy</h2>
            <p className="text-body text-text-2">
              If this policy changes in a material way, we&apos;ll update the date at the top of
              this page.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
