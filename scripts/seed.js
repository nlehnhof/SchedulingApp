// Seeds one test client with the default appointment reasons and a Mon-Fri
// 9-5 availability rule, matching the defaults called out in
// SCHEDULING_APP_ORCHESTRATION.md Phase 2 ("Seed defaults for new clients").
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

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .upsert({ email: SEED_CLIENT_EMAIL, timezone: 'America/Denver' }, { onConflict: 'email' })
    .select()
    .single();
  if (clientError) throw clientError;
  console.log(`Client: ${client.id} (${client.email})`);

  const reasons = [
    { name: 'Recommend', duration_min: 15, order: 1 },
    { name: 'Live Appointment', duration_min: 30, order: 2 },
    { name: 'Member Request', duration_min: 30, order: 3 },
    { name: 'Ecclesiastical Endorsement', duration_min: 5, order: 4 },
  ];
  for (const reason of reasons) {
    const { error } = await supabase
      .from('appointment_reasons')
      .upsert({ client_id: client.id, ...reason }, { onConflict: 'client_id,name' });
    if (error) throw error;
  }
  console.log(`Seeded ${reasons.length} appointment reasons.`);

  const { error: ruleError } = await supabase.from('rules').insert({
    client_id: client.id,
    rule_type: 'available_hours',
    day_of_week: null, // all days; add day-specific rows to override per weekday
    start_time: '09:00:00',
    end_time: '17:00:00',
    config: { permanent: true },
  });
  if (ruleError) throw ruleError;
  console.log('Seeded Mon-Fri-style 9:00-17:00 availability rule (all days).');

  console.log(`\nVisitor booking link: /visit/${client.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
