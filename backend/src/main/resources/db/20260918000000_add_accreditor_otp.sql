ALTER TABLE accreditor_access
    ADD COLUMN IF NOT EXISTS accreditor_email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_session_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS verified_session_expires_at TIMESTAMPTZ;
