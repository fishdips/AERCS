-- Update check constraint on activities to include FACULTY activity type
ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_activity_type;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT chk_activities_activity_type
    CHECK (activity_type IN ('SEMINAR', 'TRAINING', 'WORKSHOP', 'RESEARCH', 'EXTENSION', 'OUTREACH', 'MEETING', 'CONFERENCE', 'WEBINAR', 'ADMINISTRATIVE', 'FACULTY', 'OTHER'));
