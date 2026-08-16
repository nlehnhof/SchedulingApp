'use client';

import { useCalendar } from './CalendarContext';

// Persistent banner so it's never ambiguous whose calendar is being viewed
// — reflects the CURRENTLY SELECTED calendar's role, not a fixed
// account-wide fact, since an owner can also be a collaborator elsewhere
// and switch between the two (Elite team access, 0018 migration).
export default function CollaboratorBanner() {
  const { role, calendars, calendarId } = useCalendar();
  if (!role || role === 'owner') return null;

  const calendar = calendars.find((c) => c.id === calendarId);
  const name = calendar?.display_name || 'this calendar';

  return (
    <div className="border-b border-ice/30 bg-ice/12 px-4 py-2 text-center text-body-sm text-text md:px-8">
      Shared with you: <span className="font-semibold capitalize">{role}</span> access on{' '}
      <span className="font-medium">{name}</span>
      {role === 'viewer' && ' (read-only)'}
    </div>
  );
}
