-- Deleting a user must never fail or destroy the evidence references they submitted.
-- Previously referenced_by_id was NOT NULL + ON DELETE RESTRICT, which blocked
-- deleting any user who had ever submitted an evidence reference. Match the
-- SET NULL orphaning pattern already used by activities.created_by,
-- evidence.uploaded_by, and accreditor_access.created_by.

ALTER TABLE evidence_references
    ALTER COLUMN referenced_by_id DROP NOT NULL;

ALTER TABLE evidence_references
    DROP CONSTRAINT IF EXISTS evidence_references_referenced_by_id_fkey;

ALTER TABLE evidence_references
    ADD CONSTRAINT evidence_references_referenced_by_id_fkey
        FOREIGN KEY (referenced_by_id) REFERENCES users(id) ON DELETE SET NULL;
