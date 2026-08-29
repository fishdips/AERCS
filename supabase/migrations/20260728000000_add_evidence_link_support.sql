-- Add link_url column and adjust constraints to support Google Drive / Web links in evidence
ALTER TABLE evidence
    ADD COLUMN IF NOT EXISTS link_url VARCHAR(1000);

ALTER TABLE evidence
    ALTER COLUMN stored_file_name DROP NOT NULL,
    ALTER COLUMN file_path DROP NOT NULL;

ALTER TABLE evidence
    DROP CONSTRAINT IF EXISTS chk_evidence_file_type;

ALTER TABLE evidence
    ADD CONSTRAINT chk_evidence_file_type
        CHECK (file_type IN ('PDF', 'DOCX', 'XLSX', 'JPG', 'JPEG', 'PNG', 'LINK'));

ALTER TABLE evidence
    DROP CONSTRAINT IF EXISTS chk_evidence_file_size;

ALTER TABLE evidence
    ADD CONSTRAINT chk_evidence_file_size
        CHECK ((file_type = 'LINK' AND file_size >= 0) OR (file_size > 0 AND file_size <= 10485760));
