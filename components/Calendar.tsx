'use client';

import { useState } from 'react';

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
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  function changeMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    const value = { year: next.getFullYear(), month: next.getMonth() };
    setCursor(value);
    onMonthChange?.(value.year, value.month);
  }

  const cells: (string | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(cursor.year, cursor.month, i + 1);
      return d.toISOString().slice(0, 10);
    }),
  ];

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
          className="rounded-md px-2 py-1 text-text-secondary hover:bg-accent-soft/20"
        >
          ←
        </button>
        <div className="font-serif font-medium text-text-primary">
          {firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => changeMonth(1)}
          aria-label="Next month"
          className="rounded-md px-2 py-1 text-text-secondary hover:bg-accent-soft/20"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-secondary">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const meta = dayMap.get(date);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`flex h-14 flex-col items-center justify-center rounded-md border text-sm transition-colors ${
                isSelected
                  ? 'border-accent bg-accent text-white'
                  : `border-border hover:bg-accent-soft/20 ${
                      meta?.hasAvailability ? 'text-text-primary' : 'text-text-secondary/50'
                    }`
              }`}
            >
              <span>{Number(date.slice(8, 10))}</span>
              {meta && (meta.confirmedCount > 0 || meta.redFlagCount > 0) && (
                <span className="mt-0.5 flex gap-0.5">
                  {meta.confirmedCount > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  )}
                  {meta.redFlagCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
