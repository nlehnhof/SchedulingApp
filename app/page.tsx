import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown } from '@phosphor-icons/react/ssr';
import tetons from '@/public/tetons.jpg';

const FEATURES = [
  {
    title: 'Rule-based availability',
    body: 'Set available hours, per-window limits, and first-come caps once — the booking page enforces them automatically.',
  },
  {
    title: 'No double-bookings',
    body: '"First access wins" is enforced at the database level, so two visitors can never grab the same slot, even booking at the exact same moment.',
  },
  {
    title: 'Google Calendar aware',
    body: 'A manual block on your calendar gets picked up within 30 minutes and flags any appointment it conflicts with.',
  },
  {
    title: 'A link, not a login',
    body: 'Visitors book with just a name and phone number through a private link — no account required.',
  },
];

// Single self-contained home page: photographic hero + feature grid + client sign-in CTA.
// Brand direction (name, palette, typography) documented in theme_brand.md.
export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas">
      <section className="relative flex min-h-[560px] items-end overflow-hidden sm:min-h-[640px]">
        <Image
          src={tetons}
          alt="Golden aspens and mountain peaks at Grand Teton, autumn"
          fill
          priority
          placeholder="blur"
          className="animate-kenburns object-cover"
        />
        {/* Warm scrim so the hero text stays legible over the photo without flattening it */}
        <div className="absolute inset-0 bg-gradient-to-t from-text/85 via-text/35 to-text/10" />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-6 pb-16 pt-24 text-center text-white">
          <span className="animate-fade-up rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] backdrop-blur-sm">
            Gather
          </span>
          <h1 className="animate-fade-up font-display text-4xl font-semibold tracking-tight [animation-delay:120ms] sm:text-5xl">
            Time, set aside for you.
          </h1>
          <span className="h-1 w-16 animate-fade-up rounded-full bg-lume [animation-delay:260ms]" />
          <p className="max-w-xl animate-fade-up text-lg text-white/90 [animation-delay:340ms]">
            Set your available hours once. Share a link. Visitors book themselves in — no
            double-bookings, no back-and-forth, and it stays in sync with your Google Calendar.
          </p>
          <Link
            href="/dashboard"
            className="mt-2 inline-flex animate-fade-up items-center justify-center rounded-md bg-lume px-6 py-3 text-base font-medium text-white transition-all duration-300 [animation-delay:480ms] hover:-translate-y-0.5 hover:scale-105 hover:bg-lume-bright hover:shadow-lg hover:shadow-lume/30"
          >
            Client sign in
          </Link>
          <p className="animate-fade-up text-sm text-white/70 [animation-delay:600ms]">
            Visitors book through a private link from their client — there&apos;s no public
            booking page here.
          </p>
        </div>

        {/* Scroll cue — a little kinetic nudge toward the feature section below */}
        <span
          className="absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 animate-bounce text-white/70 sm:block"
          aria-hidden="true"
        >
          <ArrowDown size={20} weight="regular" />
        </span>
      </section>

      <section className="relative overflow-hidden border-t border-hairline bg-lume/20">
        {/* Decorative floating glow for a bit of ambient motion behind the cards */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-float rounded-full bg-lume/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 animate-float rounded-full bg-lume/40 blur-3xl [animation-delay:2s]" />

        <div className="relative mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 py-16 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              style={{ animationDelay: `${i * 120}ms` }}
              className="group flex animate-fade-up flex-col gap-2 rounded-xl border border-hairline bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-lume/40 hover:shadow-lg"
            >
              <h2 className="font-display text-lg font-semibold text-text transition-colors group-hover:text-lume">
                {feature.title}
              </h2>
              <p className="text-sm text-text-2">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 py-10 text-center text-xs text-text-2">
        Gather — rule-based booking, built to protect your calendar.
      </footer>
    </main>
  );
}
