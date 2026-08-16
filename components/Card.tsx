import { HTMLAttributes } from 'react';

type Padding = 'none' | 'sm' | 'md';

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-6',
};

/**
 * Base surface primitive — rounder and shadowed, unlike the ad hoc
 * `rounded-md/lg border` divs it replaces (the dashboard previously had no
 * shared card component and zero shadow usage; see theme_brand.md).
 */
export default function Card({
  padding = 'md',
  hoverable = false,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: Padding; hoverable?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-soft ${
        hoverable ? 'transition-shadow hover:shadow-medium' : ''
      } ${paddingClasses[padding]} ${className}`}
      {...props}
    />
  );
}
