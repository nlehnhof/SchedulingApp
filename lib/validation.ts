import { z } from 'zod';

// Rule types beyond the original three (available_hours, max_per_window,
// first_n_only) intentionally lean on `config` (a loose JSONB blob) rather
// than adding new dedicated columns — see 0001_init.sql's `rules` table and
// lib/availability.ts's getAvailableSlots(), which is what actually reads
// each type's config fields:
//   blackout        -> config.start_date / config.end_date ('YYYY-MM-DD', inclusive)
//   buffer_time     -> config.buffer_minutes (number)
//   min_notice      -> config.notice_hours (number)
//   sequential_fill -> config.max_gap_minutes (number)
export const ruleSchema = z.object({
  ruleType: z.enum([
    'available_hours',
    'max_per_window',
    'first_n_only',
    'blackout',
    'buffer_time',
    'min_notice',
    'sequential_fill',
  ]),
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

// PATCH /api/client/reasons/[id]: unlike reasonSchema (create), every field
// is optional here since a rename shouldn't require re-sending duration/
// order and vice versa — but at least one field must be present.
export const reasonUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    durationMin: z.number().int().positive().optional(),
    order: z.number().int().optional(),
  })
  .refine((v) => v.name !== undefined || v.durationMin !== undefined || v.order !== undefined, {
    message: 'At least one of name, durationMin, order is required',
  });

export const bookSchema = z.object({
  visitorName: z.string().min(1).max(255),
  visitorPhone: z.string().min(3).max(20),
  visitorEmail: z.string().email().max(255),
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

// Slug format shared between the branding PATCH route and the
// slug-availability GET route (PLAN.md Section 4 feature 2): lowercase
// letters, digits, hyphens only, 3-30 chars. A canonical 36-char UUID
// string can never satisfy this, so a slug can never collide with a raw
// client-UUID link (see lib/resolve-client-link.ts).
export const slugSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only');

// PATCH /api/client/branding — premium-gated (checked server-side in the
// route, never trust tier from the request body). Every field optional so
// a client can update just the slug, just the color, etc.
export const brandingSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Expected a hex color like #C4693A')
    .optional(),
  // Restricted to https:// specifically (not just any well-formed URL) so
  // this can't become a javascript:/data: XSS vector if it's ever rendered
  // somewhere less careful than an <img src> — see PLAN.md Section 5.
  logoUrl: z
    .string()
    .url()
    .refine((v) => v.startsWith('https://'), 'Logo URL must use https://')
    .optional(),
  slug: slugSchema.optional(),
  smsRemindersEnabled: z.boolean().optional(),
});

// PATCH /api/client/calendar — not premium-gated (Google Calendar sync is a
// core feature, not an upgrade). Google calendar ids are usually an email
// address (the primary calendar) or an opaque "xxxx@group.calendar.google.com"
// string, so this stays loose rather than trying to fully validate the
// shape — the route itself confirms the id is actually one of the caller's
// own calendars before saving it (see app/api/client/calendar/route.ts).
// timezone is validated with Intl.DateTimeFormat rather than a hardcoded
// list, so any real IANA zone name works (the dashboard picker only offers
// a curated subset — see app/dashboard/calendar/page.tsx — but the server
// doesn't need to be kept in lockstep with that list).
export const calendarSelectSchema = z
  .object({
    calendarId: z.string().min(1).max(255).optional(),
    timezone: z
      .string()
      .min(1)
      .max(50)
      .refine((tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Not a recognized time zone')
      .optional(),
  })
  .refine((v) => v.calendarId !== undefined || v.timezone !== undefined, {
    message: 'At least one of calendarId, timezone is required',
  });
