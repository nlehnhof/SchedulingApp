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

  return (
    <div className={`group relative rounded-md p-3 text-sm ${statusStyles[appointment.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
            {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </div>
          <div className="text-text-secondary">{reasonName ?? appointment.reason_id}</div>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
        )}
      </div>
      {appointment.status === 'red_flag' && (
        <div className="mt-1 text-xs font-medium text-danger">
          Conflicts with a Google Calendar block
        </div>
      )}
      {/* Visitor details revealed on hover per Phase 3 spec */}
      <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-surface p-2 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">
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
    </div>
  );
}
