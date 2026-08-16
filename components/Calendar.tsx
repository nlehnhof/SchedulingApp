'use client';

import { parseLocalDateOnly } from '@/lib/date-format';
import { useMonthGrid } from './useMonthGrid';
import { MonthNavHeader, WeekdayHeader } from './MonthGridHeader';

export interface CalendarDayMeta {
  date: string; // 'YYYY-MM-DD'
  confirmedCount: number;
  redFlagCount: number;
  hasAvailability: boolean;
}

/**
 * Reusable month-view calendar. Purely presentational date math (no
 * timezone library needed since we only ever compare 'YYYY-MM-DD' strings
 * against the client's single configured timezone, per Constraints).
 */
export default function Calendar({
  days,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: {
  days: CalendarDayMeta[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}) {
  const { monthLabel, cells, changeMonth } = useMonthGrid(onMonthChange);
  const dayMap = new Map(days.map((d) => [d.date, d]));

  return (
    <div className="w-full">
      <MonthNavHeader label={monthLabel} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
      <WeekdayHeader />
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const meta = dayMap.get(date);
          const isSelected = date === selectedDate;
          // A screen-reader user tabbing through day cells previously got
          // no equivalent to the confirmed/conflict dots or the dimmed
          // "no availability" styling — this is the only description of
          // that state they'd have (PLAN.md Section 1/2 item 9).
          // parseLocalDateOnly(), NOT `new Date(date)` — `date` is a plain
          // 'YYYY-MM-DD' string, and the no-offset ISO date form parses as
          // UTC midnight (unlike a full datetime string, which parses as
          // local), so `new Date(date)` silently showed the previous day
          // in any timezone behind UTC. See lib/date-format.ts.
          const dateLabel = parseLocalDateOnly(date).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
          const parts = [dateLabel];
          if (meta?.confirmedCount) parts.push(`${meta.confirmedCount} confirmed`);
          if (meta?.redFlagCount) parts.push(`${meta.redFlagCount} conflict${meta.redFlagCount === 1 ? '' : 's'}`);
          if (meta && !meta.hasAvailability) parts.push('no availability');
          const hasConfirmed = !!meta && meta.confirmedCount > 0;
          const hasConflict = !!meta && meta.redFlagCount > 0;
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              aria-label={parts.join(', ')}
              className={`relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border font-mono text-data transition-colors duration-150 ${
                isSelected
                  ? 'border-lume bg-lume text-lume-ink'
                  : meta?.hasAvailability
                    ? 'border-lume/20 text-text hover:bg-lume/8'
                    : 'border-hairline text-text-3 hover:bg-lume/8'
              }`}
            >
              <span>{Number(date.slice(8, 10))}</span>
              {(hasConfirmed || hasConflict) && (
                <span
                  className={`absolute bottom-1 h-0.5 w-5 rounded-full ${
                    hasConflict ? 'bg-rose' : 'bg-jade'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
