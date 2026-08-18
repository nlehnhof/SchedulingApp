'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetcher, postJSON } from '@/lib/fetcher';
import { parseLocalDateOnly } from '@/lib/date-format';
import { Check } from '@phosphor-icons/react';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import TimeSlotGrid, { DisplaySlot } from '@/components/TimeSlotGrid';

interface ManageData {
  appointment: { id: string; start: string; end: string; visitorName: string; status: string };
  reasonName: string | null;
  clientName: string | null;
  canManage: boolean;
  allowManagement: boolean;
  withinNotice: boolean;
}

interface ManageSlot extends DisplaySlot {
  date: string;
  time: string;
}

type View = 'summary' | 'confirmCancel' | 'cancelled' | 'reschedule' | 'rescheduled';

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Visitor-facing manage link (L7 launch phase) — resolved from a signed,
// stateless token (lib/appointment-token.ts), no login. Reachable from the
// booking confirmation screen and, when a visitor gave an email, the
// confirmation email itself.
export default function ManageAppointmentPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<ManageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('summary');

  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [slots, setSlots] = useState<ManageSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ManageSlot | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduledTo, setRescheduledTo] = useState<{ start: string; end: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    fetcher<ManageData>(`/api/manage/${token}`)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: any) => {
        setLoadError(err.message ?? 'This link is invalid.');
        setLoading(false);
      });
  }, [token]);

  function loadSlots() {
    setSlotsLoading(true);
    fetcher<{ slots: ManageSlot[] }>(`/api/manage/${token}/availability`)
      .then((r) => {
        setSlots(r.slots);
        setSlotsLoading(false);
      })
      .catch((err: any) => {
        setActionError(err.message ?? 'Could not load available times.');
        setSlotsLoading(false);
      });
  }

  const datesWithSlots = useMemo(() => {
    const set = new Set(slots.map((s) => s.date));
    return Array.from(set).sort();
  }, [slots]);
  const slotsForSelectedDate = slots.filter((s) => s.date === selectedDate);

  async function handleCancel() {
    setActionError(null);
    setCancelling(true);
    try {
      await postJSON(`/api/manage/${token}/cancel`, {});
      setView('cancelled');
    } catch (err: any) {
      setActionError(err.message ?? 'Could not cancel this appointment.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setActionError(null);
    setConflict(null);
    setRescheduling(true);
    try {
      const result = await postJSON<{ status: string; appointment?: { start: string; end: string }; message?: string }>(
        `/api/manage/${token}/reschedule`,
        { startTime: selectedSlot.start }
      );
      if (result.status === 'rescheduled' && result.appointment) {
        setRescheduledTo(result.appointment);
        setView('rescheduled');
      } else {
        setConflict(result.message ?? 'That time overlaps another appointment.');
        loadSlots();
        setSelectedSlot(null);
      }
    } catch (err: any) {
      setActionError(err.message ?? 'Could not reschedule this appointment.');
    } finally {
      setRescheduling(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-canvas px-6 py-8 sm:justify-center sm:p-6">
      <div className="flex w-full flex-1 flex-col sm:max-w-[30rem] sm:flex-none sm:rounded-2xl sm:bg-surface sm:p-6 sm:shadow-lift2">
        <h1 className="mb-4 font-display text-display-md text-text">Your appointment</h1>

        {loading && <Spinner />}

        {loadError && (
          <p className="text-body-sm text-rose">{loadError}</p>
        )}

        {!loading && !loadError && data && (
          <>
            {view === 'summary' && (
              <div className="flex flex-col gap-4 animate-fade-up">
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="font-mono text-data text-text">{fmt(data.appointment.start)}</div>
                  <div className="text-body-sm text-text-2">
                    {data.reasonName}
                    {data.clientName ? ` with ${data.clientName}` : ''}
                  </div>
                </div>

                {!data.allowManagement && (
                  <p className="text-body-sm text-text-2">
                    {data.clientName ?? 'This calendar'} handles changes to appointments directly.
                    Please contact them to cancel or reschedule.
                  </p>
                )}
                {data.allowManagement && !data.withinNotice && (
                  <p className="text-body-sm text-text-2">
                    This appointment is too close to its start time to change online. Please
                    contact {data.clientName ?? 'them'} directly.
                  </p>
                )}

                {actionError && <p className="text-body-sm text-rose">{actionError}</p>}

                {data.canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setView('reschedule');
                        setSlots([]);
                        setSelectedDate(null);
                        setSelectedSlot(null);
                        loadSlots();
                      }}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-rose hover:bg-rose/10"
                      onClick={() => setView('confirmCancel')}
                    >
                      Cancel appointment
                    </Button>
                  </div>
                )}
              </div>
            )}

            {view === 'confirmCancel' && (
              <div className="flex flex-col gap-4 animate-fade-up">
                <p className="text-body text-text">
                  Cancel your {fmt(data.appointment.start)} appointment
                  {data.clientName ? ` with ${data.clientName}` : ''}? This can&apos;t be undone.
                </p>
                {actionError && <p className="text-body-sm text-rose">{actionError}</p>}
                <div className="flex gap-2">
                  <Button variant="danger" disabled={cancelling} onClick={handleCancel}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                  </Button>
                  <Button variant="ghost" disabled={cancelling} onClick={() => setView('summary')}>
                    Never mind
                  </Button>
                </div>
              </div>
            )}

            {view === 'cancelled' && (
              <div className="flex flex-col items-center gap-2 py-4 text-center animate-fade-up">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-jade/15 text-jade">
                  <Check size={28} weight="regular" />
                </div>
                <h2 className="font-display text-display-sm text-text">Appointment cancelled</h2>
                <p className="text-body-sm text-text-2">
                  {data.clientName ?? 'They'} will be able to see this and offer the slot to someone else.
                </p>
              </div>
            )}

            {view === 'reschedule' && (
              <div className="flex flex-col gap-4 animate-fade-up">
                <p className="text-body-sm text-text-2">
                  Currently {fmt(data.appointment.start)}. Pick a new time.
                </p>
                {slotsLoading && <Spinner label="Loading availability…" />}
                <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                  {datesWithSlots.map((date) => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-11 shrink-0 snap-start rounded-lg border px-3 py-2 font-mono text-data transition-colors duration-150 ${
                        date === selectedDate
                          ? 'border-lume bg-lume text-lume-ink shadow-glow'
                          : 'border-lume/30 bg-lume/8 text-lume-bright hover:bg-lume/14 hover:shadow-glowSm'
                      }`}
                    >
                      {parseLocalDateOnly(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </button>
                  ))}
                  {!slotsLoading && datesWithSlots.length === 0 && (
                    <p className="text-body-sm text-text-2">No other openings in the next 30 days.</p>
                  )}
                </div>
                {selectedDate && (
                  <TimeSlotGrid
                    slots={slotsForSelectedDate}
                    selectedStart={selectedSlot?.start}
                    onSelect={(s) => setSelectedSlot(s as ManageSlot)}
                  />
                )}

                {conflict && (
                  <p className="text-body-sm text-rose">{conflict}</p>
                )}
                {actionError && <p className="text-body-sm text-rose">{actionError}</p>}

                <div className="flex gap-2">
                  <Button disabled={!selectedSlot || rescheduling} onClick={handleReschedule}>
                    {rescheduling ? 'Rescheduling…' : 'Confirm new time'}
                  </Button>
                  <Button variant="ghost" disabled={rescheduling} onClick={() => setView('summary')}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {view === 'rescheduled' && rescheduledTo && (
              <div className="flex flex-col items-center gap-2 py-4 text-center animate-fade-up">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-jade/15 text-jade">
                  <Check size={28} weight="regular" />
                </div>
                <h2 className="font-display text-display-sm text-text">Appointment rescheduled</h2>
                <div className="font-mono text-data text-text">{fmt(rescheduledTo.start)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
