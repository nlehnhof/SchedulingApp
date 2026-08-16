'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { Appointment, AppointmentReason } from '@/lib/types';
import Calendar, { CalendarDayMeta } from '@/components/Calendar';
import AppointmentCard from '@/components/AppointmentCard';
import AppointmentEditor, { AppointmentEditValues } from '@/components/AppointmentEditor';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useCalendar } from '@/components/CalendarContext';

interface DayBucket {
  date: string;
  slots: { start: string; end: string; available: boolean }[];
  appointments: Appointment[];
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function SchedulePage() {
  const { calendarId } = useCalendar();
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
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
    <div className="flex flex-col gap-6 lg:flex-row">
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
        {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
        <Calendar
          days={calendarDays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMonthChange={(year, month) => setMonthCursor({ year, month })}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success" /> Confirmed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-danger" /> Conflict
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-text-secondary/50 bg-text-secondary/20" />
            Dimmed = no availability
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {selectedDate ?? 'Select a date'}
        </h2>
        {!selectedDate && <p className="text-sm text-text-secondary">Click a day to see its appointments.</p>}
        {selectedDate && selectedBucket && selectedBucket.appointments.length === 0 && (
          <p className="text-sm text-text-secondary">No appointments booked on this day.</p>
        )}
        <div className="flex flex-col gap-2">
          {selectedBucket?.appointments
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((apt) =>
              confirmDeleteId === apt.id ? (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-md border border-danger/30 bg-danger/10 p-3 text-sm"
                >
                  <span className="text-danger">Delete this appointment?</span>
                  <div className="flex gap-2">
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDelete(apt.id)}>
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  reasonName={reasonNameById.get(apt.reason_id)}
                  onEdit={(a) => {
                    setEditError(null);
                    setEditingAppointment(a);
                  }}
                  onDelete={(a) => setConfirmDeleteId(a.id)}
                />
              )
            )}
        </div>
      </div>

      <Modal
        open={!!editingAppointment}
        onClose={() => setEditingAppointment(null)}
        title="Edit appointment"
      >
        {editError && <p className="mb-2 text-sm text-danger">{editError}</p>}
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
