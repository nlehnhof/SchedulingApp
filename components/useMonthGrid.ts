'use client';

import { useState } from 'react';
import { formatLocalDateOnly } from '@/lib/date-format';

export interface MonthCursor {
  year: number;
  month: number;
}

/**
 * Shared month/day-cell math — previously duplicated near-identically
 * between Calendar.tsx (single-select) and DatesMultiSelect.tsx
 * (multi-select). Both just render `cells` differently; the cursor state,
 * date generation, and month navigation are identical.
 */
export function useMonthGrid(onMonthChange?: (year: number, month: number) => void) {
  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    formatLocalDateOnly(new Date(cursor.year, cursor.month, i + 1))
  );
  const cells: (string | null)[] = [...Array(startWeekday).fill(null), ...monthDates];
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function changeMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    const value = { year: next.getFullYear(), month: next.getMonth() };
    setCursor(value);
    onMonthChange?.(value.year, value.month);
  }

  return { cursor, monthLabel, monthDates, cells, changeMonth };
}
