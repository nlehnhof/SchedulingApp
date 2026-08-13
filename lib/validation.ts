import { z } from 'zod';

export const ruleSchema = z.object({
  ruleType: z.enum(['available_hours', 'max_per_window', 'first_n_only']),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  maxConcurrent: z.number().int().positive().optional(),
  config: z.record(z.unknown()).optional(),
});

export const reasonSchema = z.object({
  name: z.string().min(1).max(255),
  durationMin: z.number().int().positive(),
  order: z.number().int().optional(),
});

export const bookSchema = z.object({
  visitorName: z.string().min(1).max(255),
  visitorPhone: z.string().min(3).max(20),
  reasonId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  notes: z.string().max(2000).optional(),
});

export const exportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected format YYYY-MM'),
});

export const appointmentEditSchema = z.object({
  visitorName: z.string().min(1).max(255),
  visitorPhone: z.string().min(3).max(20),
  reasonId: z.string().uuid(),
  startTime: z.string().min(1),
  notes: z.string().max(2000).optional(),
});
