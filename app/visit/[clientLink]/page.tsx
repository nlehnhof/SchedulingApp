'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { fetcher, postJSON } from '@/lib/fetcher';
import { parseLocalDateOnly } from '@/lib/date-format';
import { Check, X } from '@phosphor-icons/react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
import Lightline from '@/components/Lightline';
import DayStrip from '@/components/DayStrip';
import TimeSlotGrid, { DisplaySlot } from '@/components/TimeSlotGrid';

interface VisitorReason {
  id: string;
  name: string;
  durationMin: number;
  infoNote: string | null;
  requiredCheckboxes: string[];
}

interface VisitorSlot extends DisplaySlot {
  date: string;
  time: string;
  reason: string;
}

interface Branding {
  accentColor: string | null;
  logoUrl: string | null;
}

const detailsSchema = z.object({
  visitorName: z.string().min(1, 'Required'),
  visitorPhone: z.string().min(3, 'Required'),
  visitorEmail: z.string().email('Enter a valid email'),
  notes: z.string().optional(),
});
type DetailsForm = z.infer<typeof detailsSchema>;

type Step = 'reason' | 'datetime' | 'details' | 'confirmation';
const STEPS: Step[] = ['reason', 'datetime', 'details', 'confirmation'];
const STEP_LABELS: Record<Step, string> = {
  reason: 'Reason',
  datetime: 'Date & time',
  details: 'Your details',
  confirmation: 'Confirmed',
};

export default function VisitorBookingPage({ params }: { params: { clientLink: string } }) {
  const { clientLink } = params;
  const [step, setStep] = useState<Step>('reason');
  const [clientName, setClientName] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [reasons, setReasons] = useState<VisitorReason[]>([]);
  const [reasonsLoading, setReasonsLoading] = useState(true);
  const [selectedReason, setSelectedReason] = useState<VisitorReason | null>(null);
  const [slots, setSlots] = useState<VisitorSlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<VisitorSlot | null>(null);
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [checkedBoxes, setCheckedBoxes] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<{
    start: string;
    end: string;
    confirmationEmailSent?: boolean;
    manageUrl?: string;
  } | null>(null);
  const [conflict, setConflict] = useState<{ message?: string; nextAvailable?: { start: string; end: string } } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  // Previously this replaced the *entire* page (including the header and
  // whatever the visitor had already picked) on any transient fetch
  // failure. Now it's a dismissible banner layered above the current step,
  // so an in-progress reason/slot selection survives a blip (PLAN.md
  // Section 1/2 item 8).
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setReasonsLoading(true);
    fetcher<{ reasons: VisitorReason[] }>(`/api/visitor/${clientLink}/reasons`)
      .then((r) => {
        setReasons(r.reasons);
        setReasonsLoading(false);
      })
      .catch(() => {
        setLoadError('Could not load this booking page. Please try again.');
        setReasonsLoading(false);
      });
  }, [clientLink]);

  useEffect(() => {
    if (!selectedReason) return;
    setAvailabilityLoading(true);
    fetcher<{ clientName: string; branding: Branding | null; slots: VisitorSlot[] }>(
      `/api/visitor/${clientLink}/availability?reasonId=${selectedReason.id}`
    )
      .then((r) => {
        setClientName(r.clientName);
        setBranding(r.branding);
        setSlots(r.slots);
        setAvailabilityLoading(false);
      })
      .catch(() => {
        setLoadError('Could not load availability. Please try again.');
        setAvailabilityLoading(false);
      });
  }, [clientLink, selectedReason]);

  const datesWithSlots = useMemo(() => {
    const set = new Set(slots.map((s) => s.date));
    return Array.from(set).sort();
  }, [slots]);

  const slotsForSelectedDate = slots.filter((s) => s.date === selectedDate);

  const {
    register,
    handleSubmit,
    reset: resetDetailsForm,
    formState: { errors },
  } = useForm<DetailsForm>({ resolver: zodResolver(detailsSchema) });

  async function book(startTime: string) {
    if (!selectedReason || !details) return;
    setLoading(true);
    setConflict(null);
    try {
      const result = await postJSON<{
        status: 'booked' | 'conflict';
        appointment?: { start: string; end: string };
        confirmationEmailSent?: boolean;
        manageUrl?: string;
        message?: string;
        nextAvailable?: { start: string; end: string };
      }>(`/api/visitor/${clientLink}/book`, {
        visitorName: details.visitorName,
        visitorPhone: details.visitorPhone,
        visitorEmail: details.visitorEmail,
        reasonId: selectedReason.id,
        startTime,
        notes: details.notes,
        checkedRequiredCheckboxes: Object.keys(checkedBoxes).filter((label) => checkedBoxes[label]),
      });

      if (result.status === 'booked' && result.appointment) {
        setConfirmed({
          ...result.appointment,
          confirmationEmailSent: result.confirmationEmailSent,
          manageUrl: result.manageUrl,
        });
        setStep('confirmation');
      } else {
        setConflict({ message: result.message, nextAvailable: result.nextAvailable });
      }
    } catch (err: any) {
      setLoadError(err.message ?? 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Lets a visitor book a second appointment without reloading the page —
  // the confirmation step previously had no way forward at all.
  function bookAnother() {
    setStep('reason');
    setSelectedReason(null);
    setSlots([]);
    setSelectedDate(null);
    setSelectedSlot(null);
    setDetails(null);
    setCheckedBoxes({});
    setConfirmed(null);
    setConflict(null);
    resetDetailsForm();
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-canvas px-6 py-8 sm:items-center sm:justify-center sm:p-6">
      <div className="mx-auto flex w-full max-w-[30rem] flex-col items-center gap-1 text-center sm:mb-4">
        {branding?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="mb-2 h-12 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {clientName && <p className="text-body-sm text-text-2">Booking with {clientName}</p>}
      </div>

      <div className="flex w-full flex-1 flex-col sm:max-w-[30rem] sm:flex-none sm:rounded-2xl sm:bg-surface sm:p-6 sm:shadow-lift2">
        <h1 className="mb-4 font-display text-display-md text-text">Book an appointment</h1>

        {/* Step progress indicator (PLAN.md Section 1/2 item 8) — a
            first-time visitor previously had no sense of how many steps
            remained. Visual rail is decorative (aria-hidden); the sr-only
            list below carries the same aria-current/aria-label semantics
            the old numbered-circle version had. */}
        <div className="mb-6">
          <div className="relative h-4 w-full" aria-hidden="true">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />
            <Lightline at={STEPS.length > 1 ? stepIndex / (STEPS.length - 1) : 0} />
          </div>
          <div className="mt-1 flex items-center justify-between" aria-hidden="true">
            <span className="text-label text-text-2">{STEP_LABELS[step]}</span>
            <span className="font-mono text-data text-text-2">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>
          <ol className="sr-only" aria-label="Booking progress">
            {STEPS.map((s) => (
              <li key={s} aria-current={s === step ? 'step' : undefined}>
                {STEP_LABELS[s]}
              </li>
            ))}
          </ol>
        </div>

        {loadError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-rose/30 bg-rose/10 p-3 text-body-sm text-rose">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} aria-label="Dismiss" className="shrink-0 font-medium">
              <X size={16} weight="regular" />
            </button>
          </div>
        )}

      {step === 'reason' && (
        <div className="flex flex-1 flex-col gap-2 animate-fade-up">
          {reasonsLoading && <Spinner label="Loading options…" />}
          {!reasonsLoading && !loadError && reasons.length === 0 && (
            <p className="text-sm text-text-2">
              No booking reasons are available yet. Please check back later.
            </p>
          )}
          {reasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => {
                setSelectedReason(reason);
                setCheckedBoxes({});
                setStep('datetime');
              }}
              className="w-full rounded-xl border border-hairline bg-surface-2 p-4 text-left transition-all duration-150 hover:border-lume/30 hover:shadow-lift2 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-medium text-text">{reason.name}</span>
                <span className="shrink-0 font-mono text-data text-text-2">{reason.durationMin} min</span>
              </div>
              {reason.infoNote && (
                <p className="mt-1 line-clamp-2 text-body-sm text-text-2">{reason.infoNote}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {step === 'datetime' && selectedReason && (
        <div className="flex flex-1 flex-col gap-4 animate-fade-up">
          <p className="text-body-sm text-text-2">{selectedReason.name}</p>
          {availabilityLoading && <Spinner label="Loading availability…" />}
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
                {/* parseLocalDateOnly(), not `new Date(date)` — `date` is a
                    plain 'YYYY-MM-DD' string, which `new Date()` parses as
                    UTC midnight and can display a day early in any timezone
                    behind UTC. See lib/date-format.ts. */}
                {parseLocalDateOnly(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </button>
            ))}
            {!availabilityLoading && datesWithSlots.length === 0 && (
              <p className="text-body-sm text-text-2">No openings in the next 30 days yet. Check back soon.</p>
            )}
          </div>
          {selectedDate && (
            <TimeSlotGrid
              slots={slotsForSelectedDate}
              selectedStart={selectedSlot?.start}
              onSelect={(s) => setSelectedSlot(s as VisitorSlot)}
            />
          )}
          <div className="flex-1" />
          <div className="sticky bottom-0 -mx-6 flex justify-between border-t border-hairline bg-surface/95 px-6 py-3 backdrop-blur">
            <Button variant="ghost" onClick={() => setStep('reason')}>
              Back
            </Button>
            <Button disabled={!selectedSlot} onClick={() => setStep('details')}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'details' && selectedSlot && (
        <form
          onSubmit={handleSubmit((values) => {
            setDetails(values);
            book(selectedSlot.start);
          })}
          className="flex flex-1 flex-col gap-4 animate-fade-up"
        >
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="font-mono text-data text-text">
              {new Date(selectedSlot.start).toLocaleString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
            <div className="text-body-sm text-text-2">{selectedReason?.name}</div>
          </div>

          {selectedReason?.infoNote && (
            <Card padding="sm" className="text-body-sm text-text">
              {selectedReason.infoNote}
            </Card>
          )}

          <Input label="Name" {...register('visitorName')} error={errors.visitorName?.message} />
          <Input
            label="Phone"
            type="tel"
            inputMode="tel"
            {...register('visitorPhone')}
            error={errors.visitorPhone?.message}
          />
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            {...register('visitorEmail')}
            error={errors.visitorEmail?.message}
          />
          <Input label="Notes (optional)" {...register('notes')} />

          {!!selectedReason?.requiredCheckboxes.length && (
            <div className="flex flex-col gap-1">
              {selectedReason.requiredCheckboxes.map((label) => (
                <label
                  key={label}
                  className="flex min-h-11 items-center gap-2 rounded-lg text-body text-text hover:bg-lume/10"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedBoxes[label]}
                    onChange={(e) =>
                      setCheckedBoxes((prev) => ({ ...prev, [label]: e.target.checked }))
                    }
                    className="h-5 w-5 shrink-0 accent-lume"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}

          {conflict && (
            <Card padding="sm" className="animate-scale-in border-lume/40 bg-lume/25 text-body-sm text-text">
              <p className="font-medium">{conflict.message ?? 'That slot just booked!'}</p>
              {conflict.nextAvailable && (
                <div className="mt-2 flex items-center justify-between">
                  <span>
                    Try{' '}
                    <span className="font-mono text-data">
                      {new Date(conflict.nextAvailable.start).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    ?
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => book(conflict.nextAvailable!.start)}>
                      Accept
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConflict(null)}>
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <div className="flex-1" />
          <div className="sticky bottom-0 -mx-6 flex justify-between border-t border-hairline bg-surface/95 px-6 py-3 backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => setStep('datetime')}>
              Back
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !!selectedReason?.requiredCheckboxes.some((label) => !checkedBoxes[label])
              }
            >
              {loading ? 'Booking…' : 'Confirm booking'}
            </Button>
          </div>
        </form>
      )}

      {step === 'confirmation' && confirmed && (
        <div className="flex flex-1 flex-col items-center gap-2 py-4 text-center animate-fade-up">
          <div
            className="animate-scale-in mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-jade/15 text-jade"
            aria-hidden="true"
          >
            <Check size={32} weight="regular" />
          </div>
          <h2 className="font-display text-display-sm text-text">Your appointment is booked</h2>

          {(() => {
            const start = new Date(confirmed.start);
            const end = new Date(confirmed.end);
            const startMin = start.getHours() * 60 + start.getMinutes();
            const endMin = end.getHours() * 60 + end.getMinutes();
            const dayStartMin = Math.max(0, startMin - 120);
            const dayEndMin = Math.min(24 * 60, endMin + 120);
            return (
              <DayStrip
                className="my-2 w-full"
                dayStartMin={dayStartMin}
                dayEndMin={dayEndMin}
                ariaLabel="Your booked time"
                blocks={[{ startMin, endMin, booked: true, justBooked: true }]}
              />
            );
          })()}

          <div className="font-mono text-data text-text">
            {new Date(confirmed.start).toLocaleString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
          <p className="text-body-sm text-text-2">
            {selectedReason?.name}
            {clientName ? ` with ${clientName}` : ''}
          </p>
          <p className="text-body-sm text-text-2">
            The client will contact you at <span className="font-mono">{details?.visitorPhone}</span> if
            anything changes.
          </p>
          {/* confirmationEmailSent is only present at all when a send was
              actually attempted (premium client) — undefined means nothing
              was attempted, so no line renders. true/false report the real
              outcome rather than assuming success just because the client
              is premium (booking itself always succeeds either way — a
              failed confirmation email never blocks the booking). */}
          {confirmed.confirmationEmailSent === true && (
            <p className="text-body-sm text-text-2">
              We&apos;ve also sent a confirmation to {details?.visitorEmail}.
            </p>
          )}
          {confirmed.confirmationEmailSent === false && (
            <p className="text-body-sm text-text-2">
              We tried to send a confirmation to {details?.visitorEmail} but it didn&apos;t go
              through. Your appointment is still booked, and{' '}
              {clientName ?? 'the client'} can see it.
            </p>
          )}
          {confirmed.manageUrl && (
            <p className="text-body-sm text-text-2">
              Need to cancel or reschedule? Save this link:{' '}
              <Link href={confirmed.manageUrl} className="text-lume-bright hover:underline">
                Manage your appointment
              </Link>
            </p>
          )}
          <Button variant="secondary" onClick={bookAnother} className="mt-4">
            Book another appointment
          </Button>
        </div>
      )}
      </div>
    </main>
  );
}
