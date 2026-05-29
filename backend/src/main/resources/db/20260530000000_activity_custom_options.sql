ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS custom_activity_type VARCHAR(100);

ALTER TABLE activities
    DROP CONSTRAINT IF EXISTS chk_activities_activity_type;

ALTER TABLE activities
    ADD CONSTRAINT chk_activities_activity_type
        CHECK (activity_type IN (
            'SEMINAR',
            'TRAINING',
            'WORKSHOP',
            'RESEARCH',
            'EXTENSION',
            'OUTREACH',
            'MEETING',
            'CONFERENCE',
            'WEBINAR',
            'ADMINISTRATIVE',
            'OTHER'
        ));

ALTER TABLE activities
    DROP CONSTRAINT IF EXISTS chk_activities_office;

ALTER TABLE activities
    ADD CONSTRAINT chk_activities_office
        CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);

ALTER TABLE activities
    DROP CONSTRAINT IF EXISTS chk_activities_department;

ALTER TABLE activities
    ADD CONSTRAINT chk_activities_department
        CHECK (department IS NULL OR LENGTH(TRIM(department)) BETWEEN 1 AND 100);
