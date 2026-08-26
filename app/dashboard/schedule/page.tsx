'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useReducedMotion } from 'motion/react';
import { fetcher } from '@/lib/fetcher';
import { formatLocalDateOnly, parseLocalDateOnly } from '@/lib/date-format';
import type { Appointment, AppointmentReason, GoogleBlock } from '@/lib/types';
import Calendar, { CalendarDayMeta } from '@/components/Calendar';
import AppointmentCard from '@/components/AppointmentCard';
import AppointmentEditor, { AppointmentEditValues } from '@/components/AppointmentEditor';
import DayStrip, { DayStripBlock } from '@/components/DayStrip';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import Badge from '@/components/Badge';
import { useCalendar } from '@/components/CalendarContext';

interface DayBucket {
  date: string;
  slots: { start: string; end: string; available: boolean }[];
  appointments: Appointment[];
  googleEvents: GoogleBlock[];
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function SchedulePage() {
  const { calendarId, role } = useCalendar();
  const canWrite = role !== 'viewer';
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAllMonth, setShowAllMonth] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: reasonsData } = useSWR<{ reasons: AppointmentReason[] }>(
    calendarId ? `/api/client/reasons?calendarId=${calendarId}` : null,
    fetcher
  );
  const reasons = reasonsData?.reasons ?? [];
  const [reasonId, setReasonId] = useState<string>('');
  const activeReasonId = reasonId || reasons[0]?.id;

  const { startDate, endDate } = useMemo(() => {
    const start = new Date(monthCursor.year, monthCursor.month, 1);
    const end = new Date(monthCursor.year, monthCursor.month + 1, 0);
    // formatLocalDateOnly, NOT .toISOString().slice(0, 10) — the latter
    // converts to UTC first, which in any timezone ahead of UTC rolls
    // both boundaries back a day (e.g. August becomes Jul 31-Aug 30), a
    // trap this file's own date-format.ts import already exists to avoid
    // elsewhere (see todayStr below).
    return { startDate: formatLocalDateOnly(start), endDate: formatLocalDateOnly(end) };
  }, [monthCursor]);

  const scheduleUrl =
    calendarId && activeReasonId
      ? `/api/client/schedule?calendarId=${calendarId}&startDate=${startDate}&endDate=${endDate}&reasonId=${activeReasonId}`
      : null;
  const { data, isLoading } = useSWR<{ days: DayBucket[] }>(scheduleUrl, fetcher);

  const calendarDays: CalendarDayMeta[] = (data?.days ?? []).map((d) => ({
    date: d.date,
    confirmedCount: d.appointments.filter((a) => a.status === 'confirmed').length,
    redFlagCount: d.appointments.filter((a) => a.status === 'red_flag').length,
    hasAvailability: d.slots.some((s) => s.available),
  }));

  const selectedBucket = data?.days.find((d) => d.date === selectedDate);
  const reasonNameById = new Map(reasons.map((r) => [r.id, r.name]));

  const selectedDateLabel = selectedDate
    ? parseLocalDateOnly(selectedDate).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : 'Select a date';

  const monthLabel = new Date(monthCursor.year, monthCursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // "All" view: every appointment in the currently-viewed month, past and
  // future, in one chronological list — an alternative to clicking through
  // each day individually. `data.days` already covers the whole month (the
  // schedule API fetches every non-expired appointment for the calendar,
  // unfiltered by date), so this is a client-side filter/sort, not a
  // separate fetch.
  const monthDays = (data?.days ?? [])
    .filter(
      (d) => d.date >= startDate && d.date <= endDate && (d.appointments.length > 0 || d.googleEvents.length > 0)
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  function selectDate(date: string | null) {
    setShowAllMonth(false);
    setSelectedDate(date);
  }

  // Merges booked appointments + live Google Calendar events into one
  // chronological list for a day — so an event the client added straight
  // on Google (never going through the app) shows up right alongside their
  // bookings instead of only surfacing later as a red-flagged conflict.
  function renderDayItems(day: Pick<DayBucket, 'appointments' | 'googleEvents'>) {
    const items = [
      ...day.appointments.map((apt) => ({ start: apt.start_time, node: renderAppointment(apt) })),
      ...day.googleEvents.map((event) => ({ start: event.start, node: renderGoogleEvent(event) })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    return items.map((item) => item.node);
  }

  function renderGoogleEvent(event: GoogleBlock) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return (
      <div
        key={event.id}
        className="rounded-lg border border-dashed border-ice/40 bg-ice/8 p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-data text-text">
              {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to{' '}
              {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className="text-body text-text">{event.summary}</div>
          </div>
          <Badge tone="ice">Google Calendar</Badge>
        </div>
      </div>
    );
  }

  function renderAppointment(apt: Appointment) {
    if (canWrite && confirmDeleteId === apt.id) {
      return (
        <div
          key={apt.id}
          className="flex items-center justify-between rounded-lg border border-rose/30 bg-rose/10 p-3 text-body-sm"
        >
          <span className="text-rose">Delete this appointment?</span>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => handleDelete(apt.id)}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }
    return (
      <AppointmentCard
        key={apt.id}
        appointment={apt}
        reasonName={reasonNameById.get(apt.reason_id)}
        onEdit={
          canWrite
            ? (a) => {
                setEditError(null);
                setEditingAppointment(a);
              }
            : undefined
        }
        onDelete={canWrite ? (a) => setConfirmDeleteId(a.id) : undefined}
      />
    );
  }

  // The Lightline payoff (DESIGN.md section 1.1 item 2): today's real
  // availability, not just its bookings, so open gaps render lit and booked
  // segments render matte. Only present when the viewed month includes
  // today; navigating to a different month just shows the moving Lightline
  // with no colored blocks.
  const todayStr = formatLocalDateOnly(new Date());
  const todayBucket = data?.days.find((d) => d.date === todayStr);
  const todayBlocks: DayStripBlock[] = (todayBucket?.slots ?? []).map((s) => {
    const start = new Date(s.start);
    const end = new Date(s.end);
    return {
      startMin: start.getHours() * 60 + start.getMinutes(),
      endMin: end.getHours() * 60 + end.getMinutes(),
      booked: !s.available,
    };
  });

  const nowStripRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    nowStripRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [prefersReducedMotion]);

  async function handleEditSubmit(values: AppointmentEditValues) {
    if (!editingAppointment || !calendarId) return;
    setEditError(null);
    // `values.startTime` already comes out of a <input type="datetime-local">
    // as a naive local string (e.g. "2026-08-15T21:00") — wrapping it in
    // `new Date(...).toISOString()` converted it to UTC before it crossed
    // the Postgres `timestamp` (no time zone) column boundary, which
    // silently dropped the offset and got re-read as local time again: a
    // full round-trip shift by the server's UTC offset. Send it through as-is.
    const res = await fetch(`/api/client/appointments/${editingAppointment.id}?calendarId=${calendarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEditError(json?.message ?? json?.error ?? 'Failed to save changes.');
      return;
    }
    setEditingAppointment(null);
    if (scheduleUrl) mutate(scheduleUrl);
  }

  async function handleDelete(appointmentId: string) {
    if (!calendarId) return;
    const res = await fetch(`/api/client/appointments/${appointmentId}?calendarId=${calendarId}`, {
      method: 'DELETE',
    });
    if (res.ok && scheduleUrl) mutate(scheduleUrl);
    setConfirmDeleteId(null);
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6 lg:flex-row">
      <div className="lg:w-96">
        <div className="mb-4">
          <Select label="Appointment reason" value={activeReasonId} onChange={(e) => setReasonId(e.target.value)}>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.duration_min} min)
              </option>
            ))}
          </Select>
        </div>
        {isLoading && <Spinner />}
        <Calendar
          days={calendarDays}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          onMonthChange={(year, month) => setMonthCursor({ year, month })}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-label text-text-2">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-jade" /> Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-rose" /> Conflict
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-hairline" />
            Dimmed: no availability
          </span>
        </div>
      </div>

      <div className="flex-1">
        <div ref={nowStripRef} className="mb-6">
          <h2 className="mb-2 text-label uppercase text-text-2">Today</h2>
          <DayStrip blocks={todayBlocks} />
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-label text-text-2">
            {showAllMonth ? `All appointments — ${monthLabel}` : selectedDateLabel}
          </h2>
          <div
            role="tablist"
            aria-label="Schedule view"
            className="inline-flex shrink-0 gap-0.5 rounded-lg border border-edge bg-surface-2 p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showAllMonth}
              onClick={() => setShowAllMonth(false)}
              className={`rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors ${
                !showAllMonth ? 'bg-lume text-lume-ink' : 'text-text-2 hover:text-text'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showAllMonth}
              onClick={() => setShowAllMonth(true)}
              className={`rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors ${
                showAllMonth ? 'bg-lume text-lume-ink' : 'text-text-2 hover:text-text'
              }`}
            >
              All ({monthLabel})
            </button>
          </div>
        </div>

        {showAllMonth ? (
          <>
            {monthDays.length === 0 && (
              <p className="text-body-sm text-text-2">No appointments booked this month.</p>
            )}
            <div className="flex flex-col gap-5">
              {monthDays.map((day) => (
                <div key={day.date}>
                  <h3 className="mb-2 text-label uppercase text-text-2">
                    {parseLocalDateOnly(day.date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <div className="flex flex-col gap-2">{renderDayItems(day)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {!selectedDate && <p className="text-body-sm text-text-2">Click a day to see its appointments.</p>}
            {selectedDate &&
              selectedBucket &&
              selectedBucket.appointments.length === 0 &&
              selectedBucket.googleEvents.length === 0 && (
                <p className="text-body-sm text-text-2">No appointments booked on this day.</p>
              )}
            <div className="flex flex-col gap-2">
              {selectedBucket && renderDayItems(selectedBucket)}
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!editingAppointment}
        onClose={() => setEditingAppointment(null)}
        title="Edit appointment"
      >
        {editError && <p className="mb-2 text-body-sm text-rose">{editError}</p>}
        {editingAppointment && (
          <AppointmentEditor
            reasons={reasons}
            defaultValues={{
              visitorName: editingAppointment.visitor_name,
              visitorPhone: editingAppointment.visitor_phone,
              reasonId: editingAppointment.reason_id,
              startTime: toDatetimeLocal(editingAppointment.start_time),
              notes: editingAppointment.notes ?? '',
            }}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingAppointment(null)}
          />
        )}
      </Modal>
    </div>
  );
}
