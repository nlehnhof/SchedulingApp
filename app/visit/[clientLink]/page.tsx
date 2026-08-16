'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetcher, postJSON } from '@/lib/fetcher';
import { parseLocalDateOnly } from '@/lib/date-format';
import { Check, X } from '@phosphor-icons/react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import Spinner from '@/components/Spinner';
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
        setConfirmed({ ...result.appointment, confirmationEmailSent: result.confirmationEmailSent });
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

  // Applied as inline styles (not swapped Tailwind classes, which are
  // compiled statically and can't take an arbitrary per-client hex value)
  // to the page's primary call-to-action controls — the most visible,
  // lowest-risk way to reflect a premium client's accent color without a
  // full runtime theming system (PLAN.md Section 4 feature 1). Only ever
  // set when the availability response includes branding — a free-tier or
  // downgraded client's page renders with the default look.
  const accentStyle = branding?.accentColor ? { backgroundColor: branding.accentColor } : undefined;

  const stepIndex = STEPS.indexOf(step);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col p-6">
      {branding?.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt=""
          className="mb-3 h-12 w-auto object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      {clientName && <p className="mb-1 text-sm text-text-2">Booking with {clientName}</p>}
      <h1 className="mb-4 font-display text-xl font-semibold text-text">Book an appointment</h1>

      {/* Step progress indicator (PLAN.md Section 1/2 item 8) — a
          first-time visitor previously had no sense of how many steps
          remained. */}
      <ol className="mb-6 flex items-center gap-2" aria-label="Booking progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={s === step ? 'step' : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                i <= stepIndex ? 'bg-lume text-white' : 'bg-hairline text-text-2'
              }`}
              style={i <= stepIndex ? accentStyle : undefined}
            >
              {i + 1}
            </span>
            <span className={`text-xs ${i === stepIndex ? 'text-text' : 'text-text-2'}`}>
              {STEP_LABELS[s]}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-hairline" />}
          </li>
        ))}
      </ol>

      {loadError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-rose/30 bg-rose/10 p-3 text-sm text-rose">
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
              className="w-full rounded-2xl text-left transition-transform focus:outline-none focus:ring-2 focus:ring-lume/40 active:scale-[0.99]"
            >
              <Card hoverable padding="sm" className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text">{reason.name}</span>
                  <span className="shrink-0 text-xs text-text-2">{reason.durationMin} min</span>
                </div>
                {reason.infoNote && (
                  <p className="line-clamp-2 text-xs text-text-2">{reason.infoNote}</p>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}

      {step === 'datetime' && selectedReason && (
        <div className="flex flex-1 flex-col gap-4 animate-fade-up">
          <p className="text-sm text-text-2">{selectedReason.name}</p>
          {availabilityLoading && <Spinner label="Loading availability…" />}
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {datesWithSlots.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`min-h-11 shrink-0 snap-start rounded-md border px-3 py-2 text-sm transition-colors ${
                  date === selectedDate ? 'border-lume bg-lume text-white' : 'border-edge hover:bg-lume/15'
                }`}
                style={date === selectedDate ? accentStyle : undefined}
              >
                {/* parseLocalDateOnly(), not `new Date(date)` — `date` is a
                    plain 'YYYY-MM-DD' string, which `new Date()` parses as
                    UTC midnight and can display a day early in any timezone
                    behind UTC. See lib/date-format.ts. */}
                {parseLocalDateOnly(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </button>
            ))}
            {!availabilityLoading && datesWithSlots.length === 0 && (
              <p className="text-sm text-text-2">No availability in the next 30 days.</p>
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
          <div className="sticky bottom-0 -mx-6 flex justify-between border-t border-hairline bg-canvas/95 px-6 py-3 backdrop-blur">
            <Button variant="ghost" onClick={() => setStep('reason')}>
              Back
            </Button>
            <Button disabled={!selectedSlot} onClick={() => setStep('details')} style={accentStyle}>
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
          <p className="text-sm text-text-2">
            {`${new Date(selectedSlot.start).toLocaleString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}, ${selectedReason?.name}`}
          </p>

          {selectedReason?.infoNote && (
            <Card padding="sm" className="text-sm text-text">
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
                  className="flex min-h-11 items-center gap-2 rounded-md text-sm text-text hover:bg-lume/10"
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
            <Card padding="sm" className="animate-scale-in border-lume/40 bg-lume/25 text-sm text-text">
              <p className="font-medium">{conflict.message ?? 'That slot just booked!'}</p>
              {conflict.nextAvailable && (
                <div className="mt-2 flex items-center justify-between">
                  <span>
                    Try{' '}
                    {new Date(conflict.nextAvailable.start).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    ?
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => book(conflict.nextAvailable!.start)}
                      style={accentStyle}
                    >
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
          <div className="sticky bottom-0 -mx-6 flex justify-between border-t border-hairline bg-canvas/95 px-6 py-3 backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => setStep('datetime')}>
              Back
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !!selectedReason?.requiredCheckboxes.some((label) => !checkedBoxes[label])
              }
              style={accentStyle}
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
          <h2 className="font-display text-lg font-semibold text-text">Your appointment is booked!</h2>
          <p className="text-sm text-text-2">
            {`${new Date(confirmed.start).toLocaleString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}, ${selectedReason?.name}${clientName ? ` with ${clientName}` : ''}`}
          </p>
          <p className="text-sm text-text-2">
            The client will contact you at {details?.visitorPhone} if anything changes.
          </p>
          {/* confirmationEmailSent is only present at all when a send was
              actually attempted (premium client) — undefined means nothing
              was attempted, so no line renders. true/false report the real
              outcome rather than assuming success just because the client
              is premium (booking itself always succeeds either way — a
              failed confirmation email never blocks the booking). */}
          {confirmed.confirmationEmailSent === true && (
            <p className="text-sm text-text-2">
              We&apos;ve also sent a confirmation to {details?.visitorEmail}.
            </p>
          )}
          {confirmed.confirmationEmailSent === false && (
            <p className="text-sm text-text-2">
              We tried to send a confirmation to {details?.visitorEmail} but it didn&apos;t go
              through. Your appointment is still booked, and{' '}
              {clientName ?? 'the client'} can see it.
            </p>
          )}
          <Button variant="secondary" onClick={bookAnother} className="mt-4">
            Book another appointment
          </Button>
        </div>
      )}
    </main>
  );
}
