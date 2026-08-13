-- Adds an "acknowledged" flag so the client dashboard's Error Log page can
-- distinguish new errors from ones the client has already seen (Phase 3
-- "Action buttons: Acknowledge, Retry Sync").

ALTER TABLE error_log ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_error_log_client_unacked ON error_log(client_id) WHERE NOT acknowledged;
