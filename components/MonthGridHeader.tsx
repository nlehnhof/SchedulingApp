import { CaretLeft, CaretRight } from '@phosphor-icons/react';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Prev/label/next row shared by Calendar.tsx and DatesMultiSelect.tsx. */
export function MonthNavHeader({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="rounded-md px-2 py-1 text-text-2 hover:bg-lume/20"
      >
        <CaretLeft size={18} weight="regular" />
      </button>
      <div className="font-display text-display-sm text-text">{label}</div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next month"
        className="rounded-md px-2 py-1 text-text-2 hover:bg-lume/20"
      >
        <CaretRight size={18} weight="regular" />
      </button>
    </div>
  );
}

/** Sun–Sat column-label row shared by Calendar.tsx and DatesMultiSelect.tsx. */
export function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-label text-text-3">
      {WEEKDAY_LABELS.map((d) => (
        <div key={d}>{d}</div>
      ))}
    </div>
  );
}
