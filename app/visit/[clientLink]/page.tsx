'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetcher, postJSON } from '@/lib/fetcher';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TimeSlotGrid, { DisplaySlot } from '@/components/TimeSlotGrid';

interface VisitorReason {
  id: string;
  name: string;
  durationMin: number;
}

interface VisitorSlot extends DisplaySlot {
  date: string;
  time: string;
  reason: string;
}

const detailsSchema = z.object({
  visitorName: z.string().min(1, 'Required'),
  visitorPhone: z.string().min(3, 'Required'),
  notes: z.string().optional(),
});
type DetailsForm = z.infer<typeof detailsSchema>;

type Step = 'reason' | 'datetime' | 'details' | 'confirmation';

export default function VisitorBookingPage({ params }: { params: { clientLink: string } }) {
  const { clientLink } = params;
  const [step, setStep] = useState<Step>('reason');
  const [clientName, setClientName] = useState<string | null>(null);
  const [reasons, setReasons] = useState<VisitorReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<VisitorReason | null>(null);
  const [slots, setSlots] = useState<VisitorSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<VisitorSlot | null>(null);
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [confirmed, setConfirmed] = useState<{ start: string; end: string } | null>(null);
  const [conflict, setConflict] = useState<{ message?: string; nextAvailable?: { start: string; end: string } } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetcher<{ reasons: VisitorReason[] }>(`/api/visitor/${clientLink}/reasons`)
      .then((r) => setReasons(r.reasons))
      .catch(() => setLoadError('Could not load this booking page.'));
  }, [clientLink]);

  useEffect(() => {
    if (!selectedReason) return;
    fetcher<{ clientName: string; slots: VisitorSlot[] }>(
      `/api/visitor/${clientLink}/availability?reasonId=${selectedReason.id}`
    )
      .then((r) => {
        setClientName(r.clientName);
        setSlots(r.slots);
      })
      .catch(() => setLoadError('Could not load availability.'));
  }, [clientLink, selectedReason]);

  const datesWithSlots = useMemo(() => {
    const set = new Set(slots.map((s) => s.date));
    return Array.from(set).sort();
  }, [slots]);

  const slotsForSelectedDate = slots.filter((s) => s.date === selectedDate);

  const {
    register,
    handleSubmit,
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
        message?: string;
        nextAvailable?: { start: string; end: string };
      }>(`/api/visitor/${clientLink}/book`, {
        visitorName: details.visitorName,
        visitorPhone: details.visitorPhone,
        reasonId: selectedReason.id,
        startTime,
        notes: details.notes,
      });

      if (result.status === 'booked' && result.appointment) {
        setConfirmed(result.appointment);
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

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-danger">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      {clientName && <p className="mb-1 text-sm text-text-secondary">Booking with {clientName}</p>}
      <h1 className="mb-6 font-serif text-xl font-semibold text-text-primary">Book an appointment</h1>

      {step === 'reason' && (
        <div className="flex flex-col gap-2">
          {reasons.length === 0 && <p className="text-sm text-text-secondary">Loading options…</p>}
          {reasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => {
                setSelectedReason(reason);
                setStep('datetime');
              }}
              className="rounded-md border border-border p-3 text-left text-sm hover:bg-accent-soft/15"
            >
              {reason.name} ({reason.durationMin} min)
            </button>
          ))}
        </div>
      )}

      {step === 'datetime' && selectedReason && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">{selectedReason.name}</p>
          <div className="flex flex-wrap gap-2">
            {datesWithSlots.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`rounded-md border px-3 py-2 text-sm ${
                  date === selectedDate ? 'border-accent bg-accent text-white' : 'border-border'
                }`}
              >
                {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </button>
            ))}
            {datesWithSlots.length === 0 && (
              <p className="text-sm text-text-secondary">No availability in the next 30 days.</p>
            )}
          </div>
          {selectedDate && (
            <TimeSlotGrid
              slots={slotsForSelectedDate}
              selectedStart={selectedSlot?.start}
              onSelect={(s) => setSelectedSlot(s as VisitorSlot)}
            />
          )}
          <div className="flex justify-between">
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
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-text-secondary">
            {new Date(selectedSlot.start).toLocaleString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            — {selectedReason?.name}
          </p>
          <Input label="Name" {...register('visitorName')} error={errors.visitorName?.message} />
          <Input label="Phone" {...register('visitorPhone')} error={errors.visitorPhone?.message} />
          <Input label="Notes (optional)" {...register('notes')} />

          {conflict && (
            <div className="rounded-md border border-accent/40 bg-accent-soft/25 p-3 text-sm text-text-primary">
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
                      variant="secondary"
                      onClick={() => book(conflict.nextAvailable!.start)}
                    >
                      Accept
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConflict(null)}>
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('datetime')}>
              Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Booking…' : 'Confirm booking'}
            </Button>
          </div>
        </form>
      )}

      {step === 'confirmation' && confirmed && (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-lg font-semibold text-text-primary">Your appointment is booked!</h2>
          <p className="text-sm text-text-secondary">
            {new Date(confirmed.start).toLocaleString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            — {selectedReason?.name}
            {clientName ? ` with ${clientName}` : ''}
          </p>
          <p className="text-sm text-text-secondary">
            The client will contact you at {details?.visitorPhone} if anything changes.
          </p>
        </div>
      )}
    </main>
  );
}
