// Seeds one test client (with a default booking calendar) plus the default
// appointment reasons and a Mon-Fri 9-5 availability rule, matching the
// defaults called out in SCHEDULING_APP_ORCHESTRATION.md Phase 2 ("Seed
// defaults for new clients").
//
// Usage: npm run db:seed
// Loads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// automatically (below) so this works the same on Windows/macOS/Linux without
// needing shell-specific env-export syntax.
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SEED_CLIENT_EMAIL = process.env.SEED_CLIENT_EMAIL || 'test-client@example.com';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Load .env.local first.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // timezone moved off `clients` to `booking_calendars` (0014-0016
  // migrations, multi-calendar support) — clients is login/billing identity
  // only now.
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .upsert({ email: SEED_CLIENT_EMAIL }, { onConflict: 'email' })
    .select()
    .single();
  if (clientError) throw clientError;
  console.log(`Client: ${client.id} (${client.email})`);

  // This script bypasses the normal Google sign-in flow (lib/auth.ts's
  // signIn callback), which is what normally auto-creates a client's first
  // booking_calendars row — so seed it here instead. Uses the client's own
  // id, same as that callback does, so the visitor link below matches what
  // a real first-time sign-in would produce.
  const { data: calendar, error: calendarError } = await supabase
    .from('booking_calendars')
    .upsert({ id: client.id, client_id: client.id, timezone: 'America/Denver' }, { onConflict: 'id' })
    .select()
    .single();
  if (calendarError) throw calendarError;
  console.log(`Calendar: ${calendar.id}`);

  const reasons = [
    { name: 'Recommend', duration_min: 15, order: 1 },
    { name: 'Live Appointment', duration_min: 30, order: 2 },
    { name: 'Member Request', duration_min: 30, order: 3 },
    { name: 'Ecclesiastical Endorsement', duration_min: 5, order: 4 },
  ];
  for (const reason of reasons) {
    const { error } = await supabase
      .from('appointment_reasons')
      .upsert({ calendar_id: calendar.id, ...reason }, { onConflict: 'calendar_id,name' });
    if (error) throw error;
  }
  console.log(`Seeded ${reasons.length} appointment reasons.`);

  const { error: ruleError } = await supabase.from('rules').insert({
    calendar_id: calendar.id,
    rule_type: 'available_hours',
    day_of_week: null, // all days; add day-specific rows to override per weekday
    start_time: '09:00:00',
    end_time: '17:00:00',
    config: { permanent: true },
  });
  if (ruleError) throw ruleError;
  console.log('Seeded Mon-Fri-style 9:00-17:00 availability rule (all days).');

  console.log(`\nVisitor booking link: /visit/${calendar.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
