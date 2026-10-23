-- Accreditor access links are now opened only by registered accreditor accounts
-- (role ACCREDITOR_LINK) after logging in, instead of a public link + emailed OTP.
-- Each link gets a display name and is assigned to one or more accreditor accounts.

ALTER TABLE accreditor_access
    ADD COLUMN IF NOT EXISTS name VARCHAR(150);

UPDATE accreditor_access
SET name = 'Accreditor access link'
WHERE name IS NULL;

CREATE TABLE IF NOT EXISTS accreditor_access_users (
    access_id UUID NOT NULL REFERENCES accreditor_access(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (access_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_users_user_id ON accreditor_access_users(user_id);

-- Carry existing links over to any registered accreditor account whose email
-- matches the address the link was originally sent to.
INSERT INTO accreditor_access_users (access_id, user_id)
SELECT a.id, u.id
FROM accreditor_access a
JOIN users u ON LOWER(u.email) = LOWER(a.accreditor_email)
WHERE u.role = 'ACCREDITOR_LINK'
ON CONFLICT DO NOTHING;

-- The public OTP flow is gone; these columns are no longer read or written.
-- accreditor_email is kept only as a record of who legacy links were sent to.
ALTER TABLE accreditor_access
    DROP COLUMN IF EXISTS otp_hash,
    DROP COLUMN IF EXISTS otp_expires_at,
    DROP COLUMN IF EXISTS verified_session_hash,
    DROP COLUMN IF EXISTS verified_session_expires_at;
