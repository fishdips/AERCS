-- Update chk_users_office constraint on users table to allow new Service Offices
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_office;

ALTER TABLE users ADD CONSTRAINT chk_users_office
    CHECK (office IS NULL OR LENGTH(TRIM(office)) BETWEEN 1 AND 100);
