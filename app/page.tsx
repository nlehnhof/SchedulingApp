'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import tetons from '@/public/tetons.jpg';
import everest from '@/public/everest.jpg';
import MarketingNav from '@/components/marketing/MarketingNav';
import ConflictDemo from '@/components/marketing/ConflictDemo';
import Reveal from '@/components/marketing/Reveal';
import DayStrip, { DayStripBlock } from '@/components/DayStrip';
import TimeSlotGrid, { DisplaySlot } from '@/components/TimeSlotGrid';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { Check } from '@phosphor-icons/react';

const HERO_BLOCKS: DayStripBlock[] = [
  { startMin: 8 * 60, endMin: 9 * 60, booked: true },
  { startMin: 9 * 60, endMin: 10 * 60 + 30, booked: false },
  { startMin: 10 * 60 + 30, endMin: 11 * 60 + 15, booked: true },
  { startMin: 11 * 60 + 15, endMin: 13 * 60, booked: false },
  { startMin: 13 * 60, endMin: 14 * 60, booked: true },
  { startMin: 14 * 60, endMin: 16 * 60 + 30, booked: false },
  { startMin: 16 * 60 + 30, endMin: 17 * 60 + 30, booked: true },
];

const RULE_CAPABILITIES = [
  {
    title: 'Day-specific hours',
    body: 'A rule for one weekday overrides your all-days default for that day only, so a shorter Friday or a day off just works.',
  },
  {
    title: 'Booking caps',
    body: 'Cap how many appointments can land in a rolling window, or only keep the first N slots open, even if the hours are technically free.',
  },
  {
    title: 'Blackout dates',
    body: 'Close a whole date range, vacations, holidays, anything, and no slots are generated on those days regardless of your hours.',
  },
];

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const PREVIEW_REASONS = [
  { name: 'Consultation', durationMin: 30, infoNote: 'A first conversation to see if we’re a fit.' },
  { name: 'Follow-up', durationMin: 15, infoNote: null },
];

const PREVIEW_SLOTS: DisplaySlot[] = [
  { start: todayAt(9), end: todayAt(9, 30), available: true },
  { start: todayAt(9, 30), end: todayAt(10), available: false },
  { start: todayAt(10), end: todayAt(10, 30), available: true },
  { start: todayAt(10, 30), end: todayAt(11), available: true },
  { start: todayAt(11), end: todayAt(11, 30), available: false },
  { start: todayAt(13), end: todayAt(13, 30), available: true },
];

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-canvas">
      <MarketingNav />
      <Summit />
      <Hero />
      <Guarantee />
      <HowRulesWork />
      <WhatVisitorsSee />
      <Plans />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center gap-12 px-6 pb-16 pt-16 sm:px-10 lg:flex-row lg:gap-16 lg:pt-0">
      <div className="flex max-w-xl flex-col items-start gap-5 lg:w-1/2">
        <h1 className="font-display text-display-lg text-text sm:text-display-xl">
          Your open hours, and nothing else.
        </h1>
        <p className="text-body text-text-2">
          Set your availability rules once, share one private link, and visitors can only book
          the time you opened.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-lume px-6 py-3 text-body font-medium text-lume-ink shadow-glow transition-colors hover:bg-lume-bright"
        >
          Client sign in
        </Link>
      </div>
      <div className="w-full lg:w-1/2">
        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-lift3">
          <div className="mb-3 font-mono text-data text-text-2">Today</div>
          <DayStrip dayStartMin={8 * 60} dayEndMin={18 * 60} blocks={HERO_BLOCKS} />
        </div>
      </div>
    </section>
  );
}

function Guarantee() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <Image
        src={tetons}
        alt=""
        aria-hidden="true"
        fill
        placeholder="blur"
        className="object-cover grayscale contrast-125 brightness-[0.35] sepia-[0.15] hue-rotate-[190deg]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/85 to-canvas/40" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 text-center sm:px-10">
        <Reveal className="flex flex-col items-center gap-4">
          <h2 className="font-display text-display-lg text-text">
            Two people can&apos;t book the same slot.
          </h2>
          <p className="max-w-xl text-body text-text-2">
            The database decides who gets it, with a row lock at the moment of booking, not the
            app guessing after the fact.
          </p>
        </Reveal>
        <Reveal className="w-full max-w-lg" delay={0.1}>
          <ConflictDemo />
        </Reveal>
      </div>
    </section>
  );
}

function HowRulesWork() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 sm:px-10 sm:py-32">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="rounded-2xl border border-hairline bg-surface p-6">
            <div className="flex flex-col gap-4">
              <Select label="Rule type" value="available_hours" disabled onChange={() => {}}>
                <option value="available_hours">Available hours</option>
              </Select>
              <Select label="Day of week" value="1" disabled onChange={() => {}}>
                <option value="1">Monday</option>
              </Select>
              <div className="flex gap-2">
                <Input type="time" label="Start time" value="09:00" disabled readOnly onChange={() => {}} />
                <Input type="time" label="End time" value="17:00" disabled readOnly onChange={() => {}} />
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col justify-center gap-6">
          <h2 className="font-display text-display-lg text-text">How the rules work.</h2>
          <div className="flex flex-col divide-y divide-hairline">
            {RULE_CAPABILITIES.map((c) => (
              <div key={c.title} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                <h3 className="text-body font-medium text-text">{c.title}</h3>
                <p className="text-body-sm text-text-2">{c.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WhatVisitorsSee() {
  const [selectedStart, setSelectedStart] = useState<string | undefined>(undefined);

  return (
    <section className="py-24 sm:py-32">
      <Reveal className="mx-auto mb-10 max-w-5xl px-6 sm:px-10">
        <h2 className="font-display text-display-lg text-text">What the visitor sees.</h2>
      </Reveal>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 sm:px-10">
        <div className="shrink-0 snap-start rounded-2xl border border-hairline bg-surface p-5" style={{ width: 300 }}>
          <div className="mb-3 text-label uppercase text-text-2">Reason</div>
          <div className="flex flex-col gap-2">
            {PREVIEW_REASONS.map((r) => (
              <div
                key={r.name}
                className="w-full rounded-xl border border-hairline bg-surface-2 p-4 text-left transition-all duration-150 hover:border-lume/30 hover:shadow-lift2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-medium text-text">{r.name}</span>
                  <span className="shrink-0 font-mono text-data text-text-2">{r.durationMin} min</span>
                </div>
                {r.infoNote && <p className="mt-1 line-clamp-2 text-body-sm text-text-2">{r.infoNote}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 snap-start rounded-2xl border border-hairline bg-surface p-5" style={{ width: 300 }}>
          <div className="mb-3 text-label uppercase text-text-2">Date and time</div>
          <TimeSlotGrid slots={PREVIEW_SLOTS} selectedStart={selectedStart} onSelect={(s) => setSelectedStart(s.start)} />
        </div>

        <div className="shrink-0 snap-start rounded-2xl border border-hairline bg-surface p-5" style={{ width: 300 }}>
          <div className="mb-3 text-label uppercase text-text-2">Details</div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-surface-2 px-3 py-2">
              <div className="font-mono text-data text-text">Tue, 10:00 AM</div>
              <div className="text-body-sm text-text-2">Consultation</div>
            </div>
            <Input label="Name" placeholder="Jordan Lee" onChange={() => {}} />
            <Input label="Phone" placeholder="(555) 010-0100" onChange={() => {}} />
          </div>
        </div>

        <div className="shrink-0 snap-start rounded-2xl border border-hairline bg-surface p-5" style={{ width: 300 }}>
          <div className="mb-3 text-label uppercase text-text-2">Confirmed</div>
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            {/* This step's real markup uses a jade check; the marketing
                page's one-accent rule (DESIGN.md hard constraints) swaps
                it to lume here only. */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lume/15 text-lume">
              <Check size={28} weight="regular" />
            </div>
            <div className="font-mono text-data text-text">Tue, 10:00 AM</div>
            <p className="text-body-sm text-text-2">Consultation</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 sm:px-10 sm:py-32">
      <Reveal className="mb-10">
        <h2 className="font-display text-display-lg text-text">Plans that grow with you.</h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-end">
        <Reveal className="rounded-xl border border-hairline bg-surface p-6 lg:mb-6">
          <div className="font-display text-display-sm text-text">Free</div>
          <p className="mt-2 text-body-sm text-text-2">
            Rule-based availability, one booking calendar, and Google Calendar sync.
          </p>
        </Reveal>
        <Reveal
          delay={0.1}
          className="rounded-2xl border border-lume bg-surface p-8 shadow-glow"
        >
          <div className="font-display text-display-md text-text">Premium</div>
          <p className="mt-2 text-body-sm text-text-2">
            Custom branding, a custom booking link, analytics, and confirmation emails on top of
            everything in Free.
          </p>
        </Reveal>
        <Reveal delay={0.2} className="rounded-xl border border-hairline bg-surface p-6 lg:mb-6">
          <div className="font-display text-display-sm text-text">Elite</div>
          <p className="mt-2 text-body-sm text-text-2">
            Up to 5 booking calendars and shared dashboard access for your team, on top of
            everything in Premium.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Summit() {
  return (
    <section className="relative isolate overflow-hidden py-28 sm:py-36">
      <div className="absolute inset-0 motion-safe:animate-ken-burns">
        <Image
          src={everest}
          alt=""
          aria-hidden="true"
          fill
          placeholder="blur"
          className="object-cover contrast-[1.3] saturate-[1.15] brightness-[0.75]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/10" />
      {/* Warm highlight breathing over the sunlit summit — amplifies the
          photo's own golden light rather than adding a decorative UI glow;
          not the Lightline (DESIGN.md 1.1, reserved for exactly three
          places elsewhere in the product). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[58%] top-[8%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lume/60 mix-blend-screen blur-[110px] motion-safe:animate-bloom sm:h-96 sm:w-96"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 text-center sm:px-10">
        <Reveal className="flex flex-col items-center gap-4">
          <h2 className="font-display text-display-lg text-text">Your calendar has a summit.</h2>
          <p className="max-w-xl text-body text-text-2">
            The hours you open are the highest point anyone can book. Nothing gets scheduled
            above the line you draw.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-12 text-center sm:px-10">
        <span className="font-display text-display-sm text-text">Gather</span>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-lume px-6 py-3 text-body font-medium text-lume-ink transition-colors hover:bg-lume-bright"
        >
          Client sign in
        </Link>
        <p className="text-body-sm text-text-2">
          {new Date().getFullYear()} Gather. Rule-based booking, built to protect your calendar.
        </p>
      </div>
    </footer>
  );
}
