export interface DisplaySlot {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
}

export default function TimeSlotGrid({
  slots,
  selectedStart,
  onSelect,
}: {
  slots: DisplaySlot[];
  selectedStart?: string | null;
  onSelect: (slot: DisplaySlot) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-text-secondary">No time slots for this day.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const isSelected = slot.start === selectedStart;
        return (
          <button
            key={slot.start}
            disabled={!slot.available}
            onClick={() => onSelect(slot)}
            className={`rounded-md border px-2 py-2 text-sm transition-colors ${
              !slot.available
                ? 'cursor-not-allowed border-border text-text-secondary/40'
                : isSelected
                  ? 'border-accent bg-accent text-white'
                  : 'border-border text-text-primary hover:bg-accent-soft/20'
            }`}
          >
            {new Date(slot.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </button>
        );
      })}
    </div>
  );
}
