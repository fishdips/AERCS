CREATE TABLE IF NOT EXISTS accreditor_access (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       VARCHAR(128) NOT NULL UNIQUE,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    notes       TEXT
);

CREATE TABLE IF NOT EXISTS accreditor_access_evidence (
    access_id   UUID NOT NULL REFERENCES accreditor_access(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    PRIMARY KEY (access_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_token
    ON accreditor_access(token);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_expires_at
    ON accreditor_access(expires_at);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_evidence_access_id
    ON accreditor_access_evidence(access_id);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_evidence_evidence_id
    ON accreditor_access_evidence(evidence_id);
