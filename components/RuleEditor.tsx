'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from './Button';
import Input from './Input';
import Select from './Select';

const formSchema = z.object({
  ruleType: z.enum(['available_hours', 'max_per_window', 'first_n_only']),
  dayOfWeek: z.string(), // 'all' or '0'..'6'
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxConcurrent: z.string().optional(),
  firstN: z.string().optional(),
  windowMinutes: z.string().optional(),
});

export type RuleFormValues = z.infer<typeof formSchema>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RuleEditor({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Save rule',
}: {
  onSubmit: (values: RuleFormValues) => Promise<void> | void;
  onCancel?: () => void;
  initialValues?: Partial<RuleFormValues>;
  submitLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ruleType: 'available_hours', dayOfWeek: 'all', ...initialValues },
  });

  const ruleType = watch('ruleType');

  return (
    <form onSubmit={handleSubmit(async (v) => onSubmit(v))} className="flex flex-col gap-4">
      <Select label="Rule type" {...register('ruleType')}>
        <option value="available_hours">Available hours</option>
        <option value="max_per_window">Max appointments per window</option>
        <option value="first_n_only">First N only</option>
      </Select>

      {ruleType === 'available_hours' && (
        <>
          <Select label="Day of week" {...register('dayOfWeek')}>
            <option value="all">All days (permanent)</option>
            {DAY_LABELS.map((label, i) => (
              <option key={i} value={String(i)}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="time" label="Start time" {...register('startTime')} />
            <Input type="time" label="End time" {...register('endTime')} />
          </div>
        </>
      )}

      {ruleType === 'max_per_window' && (
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            label="Max concurrent"
            {...register('maxConcurrent')}
            error={errors.maxConcurrent?.message}
          />
          <Input type="number" min={1} label="Window (minutes)" {...register('windowMinutes')} />
        </div>
      )}

      {ruleType === 'first_n_only' && (
        <div className="flex gap-2">
          <Input type="number" min={1} label="First N" {...register('firstN')} />
          <Input type="number" min={1} label="Window (minutes)" {...register('windowMinutes')} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
