'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Select from './Select';
import { postJSON } from '@/lib/fetcher';
import { useCalendar } from './CalendarContext';
import { TIMEZONE_OPTIONS, detectBrowserTimezone } from '@/lib/timezone-options';

// v1 implementation per PLAN.md Section 3: "a simple sequential Modal
// series is acceptable for v1" rather than a ref-anchored callout library
// (react-joyride-style), which would need real elements to anchor to
// across page navigations and can't be verified without a live browser in
// this pass. Content references the real nav items/card by name instead of
// pointing at them directly.
const STEPS: { title: string; body: string }[] = [
  {
    title: 'Welcome to Gather',
    body: "Let's get your booking page ready in under 2 minutes.",
  },
  {
    title: 'Add your reasons',
    body:
      "Start on the Reasons page: add the reasons visitors can book you for, like \"Consultation\" or \"Follow-up\", each with its own duration.",
  },
  {
    title: 'Set your hours',
    body:
      "Then set your available hours on the Rules page. Visitors only see slots inside these windows. A day-specific rule overrides an all-days rule for that day, and capacity rules (max per window, first N only) layer on top.",
  },
  {
    title: 'Share your booking link',
    body:
      'On the Home page you\'ll find a "Your booking link" card. That\'s what you share with visitors. Copy it into your email signature, text it, or post it anywhere.',
  },
  {
    title: 'Manage bookings',
    body:
      "Once bookings come in, manage them from Schedule. If your Google Calendar sync ever hits a conflict, you'll see it under Errors.",
  },
];

// Step 0 (below) is a mandatory time zone confirmation, not part of the
// narrative STEPS array — L3 launch phase. `booking_calendars.timezone`
// defaults to 'UTC' and nothing ever populated it before this, so a
// self-serve signup who never visited /dashboard/calendar got every Google
// write-back mistagged as UTC (see lib/booking.ts's eventBody). Folding it
// into onboarding, non-skippable, catches every new signup at the one
// moment they're guaranteed to pass through.
const TOTAL_STEPS = STEPS.length + 1;

export default function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { calendarId } = useCalendar();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [tzSaving, setTzSaving] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !timezone) {
      try {
        setTimezone(detectBrowserTimezone());
      } catch {
        setTimezone('UTC');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Skip on the last narrative step onward, "Finish" on the last step, the
  // Modal's own Escape/✕, and — since this Modal opts into
  // closeOnBackdropClick — clicking outside all route through this same
  // handler, per PLAN.md Section 3 ("must not block the underlying page
  // from being used"). The time zone step (step 0) never calls this
  // directly — it's not skippable.
  async function complete() {
    if (completing) return;
    setCompleting(true);
    try {
      await postJSON('/api/client/onboarding/complete', {});
    } catch {
      // Best-effort — even if this fails, don't trap the user behind the
      // tour; it'll just show again next session.
    } finally {
      setCompleting(false);
      setStep(0);
      onClose();
    }
  }

  async function confirmTimezone() {
    if (tzSaving || !calendarId) return;
    setTzError(null);
    setTzSaving(true);
    try {
      const res = await fetch(`/api/client/calendar?calendarId=${calendarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ? JSON.stringify(json.error) : 'Could not save your time zone.');
      }
      setStep(1);
    } catch (err: any) {
      setTzError(err.message ?? 'Could not save your time zone.');
    } finally {
      setTzSaving(false);
    }
  }

  if (step === 0) {
    return (
      <Modal open={open} onClose={() => {}} title="Confirm your time zone" closeOnBackdropClick={false}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-text">
            Appointments booked through Gather are written to your Google Calendar at this time
            zone&apos;s wall-clock time. Confirm it&apos;s right before you go any further, so your
            first booking doesn&apos;t land at the wrong hour.
          </p>
          <Select label="Time zone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {!TIMEZONE_OPTIONS.some((tz) => tz.id === timezone) && timezone && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </Select>
          {tzError && <p className="text-body-sm text-rose">{tzError}</p>}
          <div className="flex items-center justify-between">
            <span className="font-mono text-data-sm text-text-2">
              Step 1 of {TOTAL_STEPS}
            </span>
            <Button onClick={confirmTimezone} disabled={tzSaving || !timezone || !calendarId}>
              {tzSaving ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  const tourStep = step - 1;
  const isLast = tourStep === STEPS.length - 1;
  const current = STEPS[tourStep];

  return (
    <Modal open={open} onClose={complete} title={current.title} closeOnBackdropClick>
      <div className="flex flex-col gap-4">
        <p className="text-body text-text">{current.body}</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-data-sm text-text-2">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          <div className="flex gap-2">
            {tourStep === 0 ? (
              <Button variant="ghost" onClick={complete} disabled={completing}>
                Skip tour
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={completing}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={complete} disabled={completing}>
                Finish
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} disabled={completing}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
