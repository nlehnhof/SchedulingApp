'use client';

import Button from './Button';
import { useMonthGrid } from './useMonthGrid';
import { MonthNavHeader, WeekdayHeader } from './MonthGridHeader';

/**
 * Controlled month-grid date picker for the `specific_dates` rule type —
 * toggle individual dates on/off, or use "Select whole month" as a one-click
 * default-open-month shortcut. Modeled on Calendar.tsx's grid/month-cursor
 * code, but multi-select instead of single-select.
 */
export default function DatesMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
}) {
  const { monthLabel, monthDates, cells, changeMonth } = useMonthGrid();
  const selected = new Set(value);

  function toggleDate(date: string) {
    if (selected.has(date)) {
      onChange(value.filter((d) => d !== date));
    } else {
      onChange([...value, date].sort());
    }
  }

  function selectWholeMonth() {
    onChange(Array.from(new Set([...value, ...monthDates])).sort());
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <div className="w-full">
      <MonthNavHeader label={monthLabel} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
      <WeekdayHeader />
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const isSelected = selected.has(date);
          return (
            <button
              type="button"
              key={date}
              onClick={() => toggleDate(date)}
              aria-pressed={isSelected}
              className={`flex h-10 items-center justify-center rounded-lg border font-mono text-data transition-colors duration-150 ${
                isSelected
                  ? 'border-lume bg-lume text-lume-ink'
                  : 'border-edge text-text hover:bg-lume/8'
              }`}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-data-sm text-text-2">
          {value.length} date{value.length === 1 ? '' : 's'} selected
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={selectWholeMonth} className="px-2 py-1 text-xs">
            Select whole month
          </Button>
          <Button type="button" variant="ghost" onClick={clearSelection} className="px-2 py-1 text-xs">
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
