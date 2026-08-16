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
        className="rounded-md px-2 py-1 text-text-secondary hover:bg-accent-soft/20"
      >
        ←
      </button>
      <div className="font-serif font-medium text-text-primary">{label}</div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next month"
        className="rounded-md px-2 py-1 text-text-secondary hover:bg-accent-soft/20"
      >
        →
      </button>
    </div>
  );
}

/** Sun–Sat column-label row shared by Calendar.tsx and DatesMultiSelect.tsx. */
export function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-secondary">
      {WEEKDAY_LABELS.map((d) => (
        <div key={d}>{d}</div>
      ))}
    </div>
  );
}
