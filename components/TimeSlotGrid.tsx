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
    return <p className="text-body-sm text-text-2">No time slots for this day.</p>;
  }

  const openCount = slots.filter((s) => s.available).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-data text-text-2">{openCount} open</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => {
          const isSelected = slot.start === selectedStart;
          return (
            <button
              key={slot.start}
              disabled={!slot.available}
              onClick={() => onSelect(slot)}
              className={`min-h-11 rounded-lg border px-2 py-2 font-mono text-data font-medium transition-colors duration-150 ${
                !slot.available
                  ? 'cursor-not-allowed border-edge bg-surface text-text-3'
                  : isSelected
                    ? 'border-lume bg-lume text-lume-ink shadow-glow'
                    : 'border-lume/30 bg-lume/8 text-lume-bright hover:bg-lume/14 hover:shadow-glowSm'
              }`}
            >
              {new Date(slot.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
