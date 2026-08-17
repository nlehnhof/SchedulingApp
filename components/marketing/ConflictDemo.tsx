'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const RACING_MS = 1200;
const RESOLVED_MS = 2400;

/**
 * The page's one storytelling animation (DESIGN.md section 6): two visitors
 * race for the same slot, the database decides, one gets the real conflict
 * copy from lib/booking.ts. One accent only, per the marketing page's hard
 * constraint, so the "loser" resolves to neutral text rather than a rose
 * error treatment.
 */
export default function ConflictDemo() {
  const prefersReducedMotion = useReducedMotion();
  const [resolved, setResolved] = useState(!!prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;
    let timeout: ReturnType<typeof setTimeout>;
    function tick(next: boolean) {
      setResolved(next);
      timeout = setTimeout(() => tick(!next), next ? RESOLVED_MS : RACING_MS);
    }
    timeout = setTimeout(() => tick(true), RACING_MS);
    return () => clearTimeout(timeout);
  }, [prefersReducedMotion]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
      {(['A', 'B'] as const).map((label, i) => {
        const isWinner = i === 0;
        return (
          <div
            key={label}
            className={`rounded-xl border p-4 transition-colors duration-300 ${
              resolved && isWinner
                ? 'border-lume bg-lume/8 shadow-glowSm'
                : 'border-hairline bg-void/60'
            }`}
          >
            <div className="text-label uppercase text-text-2">Visitor {label}</div>
            <div className="mt-1 font-mono text-data text-text">2:00 PM, Consultation</div>
            <div className="mt-2 text-body-sm">
              {!resolved && <span className="text-text-2">Booking…</span>}
              {resolved && isWinner && <span className="font-medium text-lume-bright">Booked</span>}
              {resolved && !isWinner && (
                <span className="text-text-2">That slot just booked! Try this instead?</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
