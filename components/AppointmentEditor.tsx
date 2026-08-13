'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import type { AppointmentReason } from '@/lib/types';

const schema = z.object({
  visitorName: z.string().min(1, 'Required'),
  visitorPhone: z.string().min(3, 'Required'),
  reasonId: z.string().uuid('Pick a reason'),
  startTime: z.string().min(1, 'Required'), // datetime-local value, no timezone
  notes: z.string().optional(),
});
export type AppointmentEditValues = z.infer<typeof schema>;

export default function AppointmentEditor({
  reasons,
  defaultValues,
  onSubmit,
  onCancel,
}: {
  reasons: AppointmentReason[];
  defaultValues: AppointmentEditValues;
  onSubmit: (values: AppointmentEditValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentEditValues>({ resolver: zodResolver(schema), defaultValues });

  return (
    <form onSubmit={handleSubmit(async (v) => onSubmit(v))} className="flex flex-col gap-4">
      <Input label="Visitor name" {...register('visitorName')} error={errors.visitorName?.message} />
      <Input label="Phone" {...register('visitorPhone')} error={errors.visitorPhone?.message} />
      <Select label="Reason" {...register('reasonId')} error={errors.reasonId?.message}>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.duration_min} min)
          </option>
        ))}
      </Select>
      <Input
        type="datetime-local"
        label="Start time"
        {...register('startTime')}
        error={errors.startTime?.message}
      />
      <Input label="Notes" {...register('notes')} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
