-- Migration: Add CES department and National Service Training Program service office
-- Both users.office and activities.department/office constraints enforce length (1-100),
-- which already accommodate 'CES' and 'NATIONAL_SERVICE_TRAINING_PROGRAM'.
-- This migration script records the addition for version tracking and ensures constraints are up to date.

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_office;
ALTER TABLE users ADD CONSTRAINT chk_users_office
    CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);

ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_department;
ALTER TABLE activities ADD CONSTRAINT chk_activities_department
    CHECK (department IS NULL OR LENGTH(TRIM(department)) BETWEEN 1 AND 100);

ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_office;
ALTER TABLE activities ADD CONSTRAINT chk_activities_office
    CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);
