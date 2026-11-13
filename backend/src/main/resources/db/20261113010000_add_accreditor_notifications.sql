-- Migration: In-app notifications for accreditors.
-- An accreditor is notified when a link is shared with them (SHARED) and when a link they hold is
-- about to expire (EXPIRING_24H, EXPIRING_4H). Expiry notices remember the expiry they warned about,
-- so there is at most one per accreditor / link / expiry, and a notice is ignored once staff extend
-- the link. SHARED notices leave expires_at_snapshot empty so a link can be shared again later.
--
-- The application's `ddl-auto=update` setting creates this table on startup; this file is for
-- databases that are migrated by hand.

CREATE TABLE IF NOT EXISTS accreditor_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accreditor_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_id           UUID NOT NULL REFERENCES accreditor_access(id) ON DELETE CASCADE,
    type                VARCHAR(20) NOT NULL,
    expires_at_snapshot TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at             TIMESTAMPTZ,
    CONSTRAINT chk_accreditor_notification_type
        CHECK (type IN ('SHARED', 'EXPIRING_24H', 'EXPIRING_4H')),
    CONSTRAINT uq_accreditor_notification_expiry
        UNIQUE (accreditor_id, access_id, type, expires_at_snapshot)
);

CREATE INDEX IF NOT EXISTS idx_accreditor_notifications_accreditor
    ON accreditor_notifications(accreditor_id, created_at);
