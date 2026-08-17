'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import DatesMultiSelect from './DatesMultiSelect';
import InfoTooltip from './InfoTooltip';

const formSchema = z.object({
  ruleType: z.enum([
    'available_hours',
    'specific_dates',
    'max_per_window',
    'first_n_only',
    'blackout',
    'buffer_time',
    'min_notice',
    'sequential_fill',
  ]),
  dayOfWeek: z.string(), // 'all' or '0'..'6'
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxConcurrent: z.string().optional(),
  firstN: z.string().optional(),
  windowMinutes: z.string().optional(),
  blackoutStartDate: z.string().optional(),
  blackoutEndDate: z.string().optional(),
  bufferMinutes: z.string().optional(),
  noticeHours: z.string().optional(),
  maxGapMinutes: z.string().optional(),
  specificDates: z.array(z.string()).optional(),
});

export type RuleFormValues = z.infer<typeof formSchema>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Plain-language explanations shown two ways: as a native `title` tooltip
// on each <option> (hover while the dropdown is open) and as a persistent
// blurb below the select for the currently chosen type — the tooltip alone
// isn't reliable on touch devices or every browser, so the blurb is the
// real source of truth and the tooltip is a bonus for mouse users.
const RULE_LABELS: Record<RuleFormValues['ruleType'], string> = {
  available_hours: 'Available hours',
  specific_dates: 'Specific dates',
  max_per_window: 'Max per time window',
  first_n_only: 'First N per time window',
  blackout: 'Blackout dates',
  buffer_time: 'Buffer time between appointments',
  min_notice: 'Minimum booking notice',
  sequential_fill: 'Sequential fill (push visitors to earlier slots)',
};

const RULE_DESCRIPTIONS: Record<RuleFormValues['ruleType'], string> = {
  available_hours:
    "The hours you're open for bookings on a given day, or every day. A day-specific rule overrides the \"all days\" rule for that one day.",
  specific_dates:
    'Opens exactly these calendar dates for booking, with their own start/end time, independent of your weekday hours. Use "Select whole month" to open a whole month at once.',
  max_per_window:
    'Caps how many appointments can land inside a rolling time window (for example, at most 3 appointments in any 60-minute window), even if individual slots are still technically free.',
  first_n_only:
    'Keeps only the first N bookings open in each time window; once N appointments exist in a window, the rest of that window’s slots stop being offered. Good for strict "first come, first served" capacity.',
  blackout:
    "Blocks an entire date range from bookings: vacations, holidays, or any days you're fully closed. No slots are generated on those days, regardless of your available hours.",
  buffer_time:
    'Adds a cushion of minutes before and after every booked appointment during which no new appointment can be booked. Handy for cleanup, prep, or travel time between visits.',
  min_notice:
    "Requires visitors to book at least this many hours ahead of time, so a slot can't be booked at the last minute (e.g. 2 hours' notice hides anything starting within the next 2 hours).",
  sequential_fill:
    'Only shows slots within this many minutes of the last booked appointment that day (or of the start of the day, if nothing is booked yet). Pushes visitors toward the earliest open time instead of leaving gaps. Later slots reveal themselves as earlier ones fill up.',
};

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ruleType: 'available_hours',
      dayOfWeek: 'all',
      specificDates: [],
      ...initialValues,
    },
  });

  const ruleType = watch('ruleType');
  const specificDates = watch('specificDates') ?? [];

  return (
    <form onSubmit={handleSubmit(async (v) => onSubmit(v))} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Select label="Rule type" {...register('ruleType')}>
          {(Object.keys(RULE_LABELS) as RuleFormValues['ruleType'][]).map((type) => (
            <option key={type} value={type} title={RULE_DESCRIPTIONS[type]}>
              {RULE_LABELS[type]}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5">
          <InfoTooltip text={RULE_DESCRIPTIONS[ruleType]} />
          <span className="text-body-sm text-text-2">What does this do?</span>
        </div>
      </div>

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

      {ruleType === 'specific_dates' && (
        <>
          <DatesMultiSelect
            value={specificDates}
            onChange={(dates) => setValue('specificDates', dates, { shouldDirty: true })}
          />
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

      {ruleType === 'blackout' && (
        <div className="flex gap-2">
          <Input type="date" label="Start date" {...register('blackoutStartDate')} />
          <Input type="date" label="End date" {...register('blackoutEndDate')} />
        </div>
      )}

      {ruleType === 'buffer_time' && (
        <Input
          type="number"
          min={1}
          label="Buffer minutes (before & after each appointment)"
          {...register('bufferMinutes')}
        />
      )}

      {ruleType === 'min_notice' && (
        <Input type="number" min={0} label="Minimum notice (hours)" {...register('noticeHours')} />
      )}

      {ruleType === 'sequential_fill' && (
        <Input
          type="number"
          min={1}
          label="Max gap from last appointment (minutes)"
          {...register('maxGapMinutes')}
        />
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || (ruleType === 'specific_dates' && specificDates.length === 0)}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
