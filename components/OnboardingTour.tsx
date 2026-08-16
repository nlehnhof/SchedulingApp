'use client';

import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { postJSON } from '@/lib/fetcher';

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
      "Start on the Reasons page: add the reasons visitors can book you for — like \"Consultation\" or \"Follow-up\" — each with its own duration.",
  },
  {
    title: 'Set your hours',
    body:
      "Then set your available hours on the Rules page. Visitors only see slots inside these windows. A day-specific rule overrides an all-days rule for that day, and capacity rules (max per window, first N only) layer on top.",
  },
  {
    title: 'Share your booking link',
    body:
      'On the Home page you\'ll find a "Your booking link" card — that\'s what you share with visitors. Copy it into your email signature, text it, or post it anywhere.',
  },
  {
    title: 'Manage bookings',
    body:
      "Once bookings come in, manage them from Schedule. If your Google Calendar sync ever hits a conflict, you'll see it under Errors.",
  },
];

export default function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  // Skip on step 1, "Finish" on the last step, the Modal's own Escape/✕,
  // and — since this Modal opts into closeOnBackdropClick — clicking
  // outside all route through this same handler, per PLAN.md Section 3
  // ("must not block the underlying page from being used").
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

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Modal open={open} onClose={complete} title={current.title} closeOnBackdropClick>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text">{current.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-2">
            Step {step + 1} of {STEPS.length}
          </span>
          <div className="flex gap-2">
            {step === 0 ? (
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
