'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The signature "now" indicator: a 1px lume rule at a fraction of its track.
 * Position updates are pixel-measured and driven through Motion's x/y
 * transform (never `left`/`top`) so a changing `at` glides instead of
 * jumping, per DESIGN.md section 6 ("transform and opacity only").
 */
export default function Lightline({
  orientation = 'horizontal',
  at,
  label,
}: {
  orientation?: 'horizontal' | 'vertical';
  at: number; // 0..1, fraction of the track's length
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const isHorizontal = orientation === 'horizontal';
  const clamped = Math.min(1, Math.max(0, at));

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setSize(isHorizontal ? el.offsetWidth : el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isHorizontal]);

  const offset = clamped * size;
  const glideTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div
      ref={trackRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <motion.div
        className={`absolute left-0 top-0 bg-lume shadow-glowSm ${
          isHorizontal ? 'h-full w-px' : 'h-px w-full'
        }`}
        initial={false}
        animate={{
          x: isHorizontal ? offset : 0,
          y: isHorizontal ? 0 : offset,
          opacity: prefersReducedMotion ? 1 : [0.55, 1, 0.55],
        }}
        transition={{
          x: glideTransition,
          y: glideTransition,
          opacity: prefersReducedMotion
            ? { duration: 0 }
            : { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      {label && (
        <motion.span
          initial={false}
          animate={{
            x: isHorizontal ? `calc(${offset}px - 50%)` : 0,
            y: isHorizontal ? 0 : `calc(${offset}px - 50%)`,
          }}
          transition={glideTransition}
          className={`absolute whitespace-nowrap rounded-full bg-lume px-1.5 py-0.5 font-mono text-data-sm text-lume-ink ${
            isHorizontal ? 'left-0 bottom-full mb-1' : 'left-full top-0 ml-2'
          }`}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}
