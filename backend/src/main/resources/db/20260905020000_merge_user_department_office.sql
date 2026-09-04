-- Users belong to exactly one org unit (a department/college OR a non-academic
-- office), never both — the app already treated them as one combined field
-- everywhere in the UI. This merges the two DB columns into one: users.office
-- now holds either a Department or an Office enum name.

UPDATE users SET office = COALESCE(department, office);

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_department;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_office;

ALTER TABLE users DROP COLUMN IF EXISTS department;

ALTER TABLE users ADD CONSTRAINT chk_users_office
    CHECK (office IS NULL OR office IN (
        'CEA', 'CMBA', 'CASE', 'CNAHS', 'CCS', 'CCJ',
        'QUALITY_ASSURANCE_OFFICE', 'RESEARCH_OFFICE', 'EXTENSION_OFFICE', 'REGISTRARS_OFFICE',
        'LIBRARY', 'STUDENT_AFFAIRS_OFFICE', 'FACILITIES_MANAGEMENT_OFFICE', 'HUMAN_RESOURCE_OFFICE'
    ));
