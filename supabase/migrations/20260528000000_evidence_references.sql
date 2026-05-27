CREATE TABLE IF NOT EXISTS evidence_references (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id          UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    activity_id          UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    referenced_by_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    referenced_by_office VARCHAR(100) NOT NULL,
    accreditation_area   VARCHAR(50),
    note                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evidence_reference_activity UNIQUE (evidence_id, activity_id),
    CONSTRAINT chk_evidence_reference_area
        CHECK (accreditation_area IS NULL OR accreditation_area IN ('FACULTY', 'INSTRUCTION', 'LIBRARY', 'LABORATORIES', 'FACILITIES', 'STUDENT_SERVICES', 'RESEARCH', 'EXTENSION', 'ADMINISTRATION'))
);

ALTER TABLE evidence_references
    ADD COLUMN IF NOT EXISTS referenced_by_office VARCHAR(100);

UPDATE evidence_references er
SET referenced_by_office = COALESCE(NULLIF(u.department, ''), NULLIF(a.office, ''), NULLIF(a.department, ''), 'Institutional User')
FROM users u, activities a
WHERE er.referenced_by_id = u.id
  AND er.activity_id = a.id
  AND (er.referenced_by_office IS NULL OR TRIM(er.referenced_by_office) = '');

ALTER TABLE evidence_references
    ALTER COLUMN referenced_by_office SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_reference_activity_idx
    ON evidence_references(evidence_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_evidence_references_evidence_id
    ON evidence_references(evidence_id);

CREATE INDEX IF NOT EXISTS idx_evidence_references_activity_id
    ON evidence_references(activity_id);

CREATE INDEX IF NOT EXISTS idx_evidence_references_referenced_by_id
    ON evidence_references(referenced_by_id);
