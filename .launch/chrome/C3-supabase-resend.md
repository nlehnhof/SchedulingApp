# C3 — Supabase + Resend

Read `.launch/chrome/README.md` first. The service-role key and the Resend API key are secrets —
Claude navigates, the user copies.

## Part 1 — Supabase, upgrade first

The Free plan **pauses a project after one week of inactivity** and takes **no automatic
backups**. Upgrade the production project to **Pro ($25/mo)** before running migrations, so the
backup exists before the destructive one runs.

Confirm afterwards: Settings → Database shows daily backups with 7-day retention.

## Part 2 — Take a backup, then migrate

Migrations live in `supabase/migrations/`, `0001` through `0021`. They must run **in order**.

- `0005_service_role_grants.sql` looks redundant and is not — tables created through the SQL
  Editor don't inherit `service_role` grants, which surfaces later as Postgres `42501
  permission denied` even though RLS is correct.
- **`0016_calendar_id_fk_move.sql` is destructive.** It drops `client_id` off five tables and
  several columns off `clients`. Backup first, no exceptions.

Paste each file into the SQL Editor in order and run it. After the last one, spot-check:
`booking_calendars`, `client_collaborators`, `premium_grants`, and `appointments.google_event_id`
all exist, and `premium_grants` contains `n.lehnhof01@gmail.com`.

Claude can read the migration files from the repo and paste them, but **the user clicks Run**
on `0016`.

## Part 3 — Resend

resend.com → Domains → Add `gathertime.com`. Resend prints DKIM, SPF, and usually MX records
for a `send.` subdomain. Claude reads them back; **the user adds them at the registrar.**

Wait for Verified. Until it is, Resend is in sandbox and delivers **only** to your own account
address — every customer's booking confirmation silently goes nowhere, with no error anywhere
in the app.

Then: API Keys → create one scoped to sending only. The user copies it to Render.

Set `EMAIL_FROM_ADDRESS=noreply@gathertime.com`. Send a test to a non-Gmail address (Outlook or
iCloud) and confirm it doesn't land in spam. If it does, the SPF/DKIM records are wrong or
incomplete.

## Done when

- [ ] Supabase on Pro, backups confirmed, a backup taken before `0016`
- [ ] Migrations 0001–0021 all applied, spot-checks pass
- [ ] `gathertime.com` Verified in Resend
- [ ] Test email delivered to a non-Gmail inbox, not spam
