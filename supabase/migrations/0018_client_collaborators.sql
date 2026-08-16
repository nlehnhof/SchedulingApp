-- Elite feature: shared dashboard access for other emails, without sharing
-- the owner's own Google login. Scoped to calendar_id (not client_id) —
-- deliberately, per the settled requirement that a collaborator's role can
-- vary by calendar ("Editor on the Counseling calendar, Viewer on the
-- Building Reservations calendar"), which is exactly what
-- UNIQUE(calendar_id, email) below encodes: the same email can appear in
-- multiple rows across different calendars (even different owning clients),
-- each with its own independent role. See gather-elite-proposal.md's
-- Feature 2 and the approved plan.
CREATE TABLE client_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES booking_calendars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
  invited_by UUID NOT NULL REFERENCES clients(id),
  accepted_at TIMESTAMP,
  UNIQUE (calendar_id, email)
);

-- Same lowercase-email convention as premium_grants (0010) — invites are
-- matched against a signing-in email case-insensitively, so storing
-- anything but lowercase here would make that comparison unreliable.
ALTER TABLE client_collaborators ADD CONSTRAINT client_collaborators_email_lowercase CHECK (email = lower(email));

-- Needed for lib/auth.ts's signIn/session callbacks, which look up
-- pending/accepted invites by the signing-in email on every login/session
-- read — without this it's a full-table scan on every request.
CREATE INDEX idx_client_collaborators_email ON client_collaborators(email);
CREATE INDEX idx_client_collaborators_calendar_id ON client_collaborators(calendar_id);

ALTER TABLE client_collaborators ENABLE ROW LEVEL SECURITY;
GRANT ALL ON client_collaborators TO service_role;
