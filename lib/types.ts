export interface Client {
  id: string;
  email: string;
  timezone: string;
  tier: 'free' | 'premium';
  display_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
  slug: string | null;
  sms_reminders_enabled: boolean;
  tutorial_completed_at: string | null;
  google_calendar_id: string;
}

export interface AppointmentReason {
  id: string;
  client_id: string;
  name: string;
  duration_min: number;
  order: number;
}

export interface Rule {
  id: string;
  client_id: string;
  rule_type:
    | 'available_hours'
    | 'max_per_window'
    | 'first_n_only'
    | 'blackout'
    | 'buffer_time'
    | 'min_notice';
  day_of_week: number | null; // 0=Sunday .. 6=Saturday, null = all days
  start_time: string | null; // 'HH:MM:SS'
  end_time: string | null;
  max_concurrent: number | null;
  config: Record<string, unknown> | null;
}

export interface Appointment {
  id: string;
  client_id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  reason_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  notes: string | null;
  status: 'confirmed' | 'red_flag';
  expires_at: string | null;
}

export interface ErrorLogEntry {
  id: string;
  client_id: string;
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
  message?: string;
  nextAvailable?: Slot;
}
