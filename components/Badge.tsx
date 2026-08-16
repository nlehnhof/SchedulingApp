import { HTMLAttributes } from 'react';

type Tone = 'accent' | 'ice' | 'jade' | 'rose' | 'neutral';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-lume/14 text-lume-bright',
  ice: 'bg-ice/14 text-ice',
  jade: 'bg-jade/14 text-jade',
  rose: 'bg-rose/14 text-rose',
  neutral: 'bg-text-2/12 text-text-2',
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-micro ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
