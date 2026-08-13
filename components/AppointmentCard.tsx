'use client';

import { useId, useState } from 'react';
import type { Appointment } from '@/lib/types';

const statusStyles: Record<Appointment['status'], string> = {
  confirmed: 'border-l-4 border-success bg-success/10',
  red_flag: 'border-l-4 border-danger bg-danger/10',
};

export default function AppointmentCard({
  appointment,
  reasonName,
  onEdit,
  onDelete,
}: {
  appointment: Appointment;
  reasonName?: string;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointment: Appointment) => void;
}) {
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <div className={`relative rounded-md p-3 text-sm ${statusStyles[appointment.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
            {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className="text-text-secondary">{reasonName ?? appointment.reason_id}</div>
        </div>
        {/* Previously only revealed via group-hover, which meant no
            keyboard-focus or touch-tap equivalent existed — unusable on a
            tablet/phone, the plausible primary device for checking a
            schedule in the field (PLAN.md Section 1/2 item 4). Always
            visible now, plus an explicit contact-info disclosure toggle
            below rather than an opacity-hover overlay. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-white/70"
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(appointment)}
              className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-white/70"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(appointment)}
              className="rounded px-1.5 py-0.5 text-xs text-danger hover:bg-white/70"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {appointment.status === 'red_flag' && (
        <div className="mt-1 text-xs font-medium text-danger">
          Conflicts with a Google Calendar block
        </div>
      )}
      {expanded && (
        <div id={detailsId} className="mt-2 rounded-md border border-border bg-surface p-2 text-xs">
          <div>
            <span className="font-medium">Name:</span> {appointment.visitor_name}
          </div>
          <div>
            <span className="font-medium">Phone:</span> {appointment.visitor_phone}
          </div>
          {appointment.notes && (
            <div>
              <span className="font-medium">Notes:</span> {appointment.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
