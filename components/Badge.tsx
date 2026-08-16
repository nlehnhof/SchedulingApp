import { HTMLAttributes } from 'react';

type Tone = 'accent' | 'highlight' | 'success' | 'danger' | 'neutral';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-accent-soft/40 text-accent-hover',
  highlight: 'bg-highlight-soft/60 text-highlight-hover',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-text-secondary/15 text-text-secondary',
};

/**
 * Small status/tag pill — previously hand-rolled once-off on the Reminders
 * page ("Active" / "Not yet live" badges); this generalizes that pattern for
 * reuse app-wide (tier locks, rule-type labels, appointment status, etc.).
 */
export default function Badge({
  tone = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
