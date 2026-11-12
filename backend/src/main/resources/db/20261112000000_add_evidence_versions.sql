-- Migration: Add content versioning support for evidence files.
-- Adds `current_version` on `evidence` and creates `evidence_versions` so prior
-- revisions of a file remain inspectable, downloadable, and restorable.

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS evidence_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id         UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL,
    original_file_name  VARCHAR(255) NOT NULL,
    stored_file_name    VARCHAR(255),
    file_path           VARCHAR(500),
    file_type           VARCHAR(20) NOT NULL,
    file_size           BIGINT NOT NULL DEFAULT 0,
    file_hash           VARCHAR(64),
    version_note        TEXT,
    uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evidence_version_number UNIQUE (evidence_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_evidence_versions_evidence_id ON evidence_versions(evidence_id);

