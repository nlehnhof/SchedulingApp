'use client';

import { useEffect, useState } from 'react';
import Lightline from './Lightline';

export interface DayStripBlock {
  startMin: number; // minutes from midnight
  endMin: number;
  booked: boolean;
}

const MINUTE_MS = 60_000;

/**
 * One day as a horizontal band: matte blocks for booked time, lit gaps for
 * open time, hour ticks, and a live Lightline at the current time. Used on
 * the marketing hero (Phase 10) with real shaped data and on the dashboard
 * as a day overview (Phase 6) — the same component in both places is what
 * keeps the marketing page honest.
 */
export default function DayStrip({
  blocks,
  dayStartMin = 0,
  dayEndMin = 24 * 60,
  className = '',
}: {
  blocks: DayStripBlock[];
  dayStartMin?: number;
  dayEndMin?: number;
  className?: string;
}) {
  const span = dayEndMin - dayStartMin;
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }
    tick();
    const id = setInterval(tick, MINUTE_MS);
    return () => clearInterval(id);
  }, []);

  const hourTicks = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => dayStartMin + i * 60).filter(
    (m) => m >= dayStartMin && m <= dayEndMin
  );

  const nowAt =
    nowMin !== null && nowMin >= dayStartMin && nowMin <= dayEndMin ? (nowMin - dayStartMin) / span : null;

  const nowLabel =
    nowMin !== null
      ? new Date(0, 0, 0, Math.floor(nowMin / 60), nowMin % 60).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : undefined;

  return (
    <div
      className={`relative h-16 w-full overflow-hidden rounded-xl border border-hairline bg-surface ${className}`}
      role="img"
      aria-label="Today's schedule"
    >
      {hourTicks.map((m) => (
        <span
          key={m}
          className="absolute top-0 h-full w-px bg-hairline"
          style={{ left: `${((m - dayStartMin) / span) * 100}%` }}
        />
      ))}
      {blocks.map((b, i) => {
        const clampedStart = Math.max(b.startMin, dayStartMin);
        const clampedEnd = Math.min(b.endMin, dayEndMin);
        const width = ((clampedEnd - clampedStart) / span) * 100;
        if (width <= 0) return null;
        return (
          <span
            key={i}
            className={`absolute top-0 h-full ${b.booked ? 'bg-surface-2' : 'bg-lume/8'}`}
            style={{ left: `${((clampedStart - dayStartMin) / span) * 100}%`, width: `${width}%` }}
          />
        );
      })}
      {nowAt !== null && <Lightline at={nowAt} label={nowLabel} />}
    </div>
  );
}
