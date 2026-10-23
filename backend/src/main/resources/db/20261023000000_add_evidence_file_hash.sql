-- Migration: Add file_hash to evidence, used to detect the same file being
-- uploaded more than once across different activities, offices and departments.
-- (Hibernate ddl-auto=update will also add this column automatically on
-- startup; this file documents the change and adds the supporting index.)

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_evidence_file_hash ON evidence(file_hash);
