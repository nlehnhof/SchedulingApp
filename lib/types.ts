import type { Tier } from './tier';

// clients: login/billing identity only. Branding (display_name, accent_color,
// logo_url, slug), google_calendar_id, and timezone all moved to
// BookingCalendar below — a client can now own several independently
// configured calendars, so those fields stopped being meaningful at the
// client level (0014-0016 migrations).
export interface Client {
  id: string;
  email: string;
  tier: Tier;
  sms_reminders_enabled: boolean;
  tutorial_completed_at: string | null;
}

export interface BookingCalendar {
  id: string;
  client_id: string;
  display_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
  slug: string | null;
  google_calendar_id: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentReason {
  id: string;
  calendar_id: string;
  name: string;
  duration_min: number;
  order: number;
  info_note: string | null;
  required_checkboxes: string[];
}

export interface Rule {
  id: string;
  calendar_id: string;
  rule_type:
    | 'available_hours'
    | 'specific_dates'
    | 'max_per_window'
    | 'first_n_only'
    | 'blackout'
    | 'buffer_time'
    | 'min_notice'
    | 'sequential_fill';
  day_of_week: number | null; // 0=Sunday .. 6=Saturday, null = all days
  start_time: string | null; // 'HH:MM:SS'
  end_time: string | null;
  max_concurrent: number | null;
  config: Record<string, unknown> | null;
}

export interface Appointment {
  id: string;
  calendar_id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  reason_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  notes: string | null;
  status: 'confirmed' | 'red_flag';
  expires_at: string | null;
  google_event_id: string | null;
}

export interface ErrorLogEntry {
  id: string;
  calendar_id: string;
  error_type: string;
  message: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface GoogleBlock {
  id: string;
  summary: string;
  start: string; // ISO
  end: string; // ISO
}

export interface Slot {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
  reason: string | null;
}

export interface BookingResult {
  status: 'booked' | 'conflict';
  appointment?: {
    id: string;
    start: string;
    end: string;
  };
  // Only present when a confirmation email was actually attempted (premium
  // client). Absent entirely for a free-tier client — that's how the
  // visitor UI tells "not applicable" apart from "attempted and failed".
  confirmationEmailSent?: boolean;
  // Path to the visitor's manage link (cancel/reschedule, L7 launch phase)
  // — always present on a successful booking, even with no visitor email,
  // since the confirmation screen itself is the primary delivery channel
  // (see lib/booking.ts). Relative, not absolute — the caller already knows
  // its own origin.
  manageUrl?: string;
  message?: string;
  nextAvailable?: Slot;
}
