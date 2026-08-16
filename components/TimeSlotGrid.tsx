import type { CSSProperties } from 'react';

export interface DisplaySlot {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
}

export default function TimeSlotGrid({
  slots,
  selectedStart,
  onSelect,
  accentStyle,
}: {
  slots: DisplaySlot[];
  selectedStart?: string | null;
  onSelect: (slot: DisplaySlot) => void;
  // A branded client's accent color, applied to the selected slot — without
  // this, the selected slot always showed the default accent regardless of
  // branding, while every other CTA in the booking flow was already on-brand.
  accentStyle?: CSSProperties;
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
            style={isSelected ? accentStyle : undefined}
            className={`min-h-11 rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
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
