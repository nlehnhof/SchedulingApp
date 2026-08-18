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
//   specific_dates  -> config.dates (string[] of 'YYYY-MM-DD') + startTime/endTime,
//                      same time columns as available_hours but keyed by exact
//                      calendar date instead of day_of_week — see
//                      lib/availability.ts's findSpecificDateRules()
//   available_hours and specific_dates also both read
//   config.fill_direction ('forward' | 'backward', optional, defaults to
//   'forward' when absent) — which end of that one rule's window slots get
//   generated from. Per rule, not per calendar: each available-hours block
//   picks its own direction independently — see
//   lib/availability.ts's ruleFillDirection(). A calendar can also have
//   several disjoint available_hours/specific_dates windows on the same
//   day (e.g. an 8-11 block and a separate 12-2:30 block) — all of them
//   apply, each with its own fill direction — see
//   lib/availability.ts's findDayRules().
export const ruleSchema = z
  .object({
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
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    maxConcurrent: z.number().int().positive().optional(),
    config: z.record(z.unknown()).optional(),
  })
  .refine(
    (v) =>
      v.ruleType !== 'specific_dates' ||
      (Array.isArray((v.config as any)?.dates) &&
        (v.config as any).dates.length > 0 &&
        (v.config as any).dates.every(
          (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
        )),
    { message: 'specific_dates rules require config.dates as a non-empty array of YYYY-MM-DD strings' }
  );

export const reasonSchema = z.object({
  name: z.string().min(1).max(255),
  durationMin: z.number().int().positive(),
  order: z.number().int().optional(),
  // infoNote: client-authored text shown to the visitor while booking this
  // reason (not to be confused with bookSchema.notes / appointments.notes,
  // which is the visitor's own free-text note to the client, the opposite
  // direction). requiredCheckboxes: label strings the visitor must all tick
  // before they can submit a booking — enforced server-side in
  // app/api/visitor/[clientLink]/book/route.ts, never trusted from the client.
  infoNote: z.string().max(2000).optional(),
  requiredCheckboxes: z.array(z.string().min(1).max(255)).max(20).optional(),
});

// PATCH /api/client/reasons/[id]: unlike reasonSchema (create), every field
// is optional here since a rename shouldn't require re-sending duration/
// order and vice versa — but at least one field must be present.
export const reasonUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    durationMin: z.number().int().positive().optional(),
    order: z.number().int().optional(),
    infoNote: z.string().max(2000).optional(),
    requiredCheckboxes: z.array(z.string().min(1).max(255)).max(20).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.durationMin !== undefined ||
      v.order !== undefined ||
      v.infoNote !== undefined ||
      v.requiredCheckboxes !== undefined,
    {
      message: 'At least one of name, durationMin, order, infoNote, requiredCheckboxes is required',
    }
  );

export const bookSchema = z.object({
  visitorName: z.string().min(1).max(255),
  visitorPhone: z.string().min(3).max(20),
  visitorEmail: z.string().email().max(255),
  reasonId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  notes: z.string().max(2000).optional(),
  // Labels the visitor claims to have checked, for reasons with
  // required_checkboxes — the book route re-verifies this against the
  // reason's actual stored list rather than trusting it outright.
  checkedRequiredCheckboxes: z.array(z.string()).optional(),
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

// POST /api/manage/[token]/reschedule — visitor-facing (L7 launch phase).
// Only the new time is ever taken from the request; visitor identity,
// reason, and notes are re-read from the existing appointment row server-side.
export const rescheduleSchema = z.object({
  startTime: z.string().min(1),
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

// PATCH /api/client/branding — premium-or-above-gated (checked server-side
// in the route, never trust tier from the request body), scoped to one
// booking_calendars row (?calendarId= query param, see
// lib/require-calendar.ts). Every field optional so a client can update
// just the slug, just the color, etc. sms_reminders_enabled moved out to
// its own client-level (not per-calendar) route/schema below — see
// gather-elite-proposal.md B1's reasoning for why it stayed client-level.
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
});

// PATCH /api/client/reminders — client-level (not per-calendar): a text-
// reminders opt-in is a delivery-channel preference tied to the account,
// not a per-storefront branding concern.
export const remindersSchema = z.object({
  smsRemindersEnabled: z.boolean(),
});

// Per-calendar name/branding fields, shared by the calendars CRUD route
// (app/api/client/calendars/route.ts) — same shape as brandingSchema's
// fields since creating/renaming a calendar and editing its branding are
// conceptually the same operation on the same booking_calendars columns.
export const calendarCreateSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  // L3 launch phase — sent by the client-side create form
  // (app/dashboard/calendars/page.tsx) via Intl.DateTimeFormat's detected
  // zone, so calendar #2+ on an Elite account doesn't reintroduce the same
  // UTC-default bug the onboarding step fixes for calendar #1. Validated
  // the same way as calendarSelectSchema's timezone field, below.
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
});

// PATCH /api/client/calendar — not premium-gated (Google Calendar sync is a
// core feature, not an upgrade), scoped to one booking_calendars row
// (?calendarId= query param). Named `googleCalendarId` (not `calendarId`)
// specifically to avoid colliding with the booking-calendar-scoping
// `calendarId` query param every route now takes — this field is GOOGLE's
// own calendar id string, an unrelated concept (see
// lib/google-calendar.ts's naming-note comments). Google calendar ids are
// usually an email address (the primary calendar) or an opaque
// "xxxx@group.calendar.google.com" string, so this stays loose rather than
// trying to fully validate the shape — the route itself confirms the id is
// actually one of the caller's own Google calendars before saving it (see
// app/api/client/calendar/route.ts). timezone is validated with
// Intl.DateTimeFormat rather than a hardcoded list, so any real IANA zone
// name works (the dashboard picker only offers a curated subset — see
// app/dashboard/calendar/page.tsx — but the server doesn't need to be kept
// in lockstep with that list).
export const calendarSelectSchema = z
  .object({
    googleCalendarId: z.string().min(1).max(255).optional(),
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
    // Visitor self-service cancel/reschedule (L7 launch phase) — a
    // per-calendar opt-out for clients who want to handle changes
    // themselves rather than have visitors act directly. See
    // app/api/manage/[token]/* and the 0023 migration.
    allowVisitorManagement: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.googleCalendarId !== undefined || v.timezone !== undefined || v.allowVisitorManagement !== undefined,
    {
      message: 'At least one of googleCalendarId, timezone, allowVisitorManagement is required',
    }
  );

// POST /api/client/team — Elite team access (0018 migration), owner-only.
// Email is lowercased at validation time to match client_collaborators'
// lowercase-only CHECK constraint and the case-insensitive lookup
// lib/auth.ts's signIn/session callbacks do against a signing-in email.
export const teamInviteSchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .transform((e) => e.toLowerCase()),
  role: z.enum(['viewer', 'editor']),
});

// PATCH /api/client/team/[id] — change an existing collaborator's role.
export const teamRoleUpdateSchema = z.object({
  role: z.enum(['viewer', 'editor']),
});
