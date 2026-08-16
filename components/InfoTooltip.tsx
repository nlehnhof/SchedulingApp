'use client';

import { Info } from '@phosphor-icons/react';

/**
 * Small info affordance that reveals an explanation on demand, instead of a
 * permanently-visible paragraph of copy. Built on native <details>/<summary>
 * rather than JS-driven show/hide state — that gets tap support on mobile
 * and click support on desktop for free, with no extra event handling.
 */
export default function InfoTooltip({ text, label = 'More info' }: { text: string; label?: string }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        aria-label={label}
        className="inline-flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-edge text-text-2 transition-colors hover:border-lume hover:text-lume [&::-webkit-details-marker]:hidden"
      >
        <Info size={14} weight="regular" />
      </summary>
      <p className="animate-scale-in absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-hairline bg-surface p-3 text-body-sm leading-relaxed text-text-2 shadow-lift2">
        {text}
      </p>
    </details>
  );
}
