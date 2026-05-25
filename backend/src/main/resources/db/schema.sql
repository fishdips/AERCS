-- AERCS Database Schema
-- Run this ONCE in the Supabase SQL Editor before starting the application.

-- NOTE: To add new roles in the future, add them to this enum and to UserRole.java
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'ADMIN',
        'DEPT_STAFF',
        'ACCRED_COORDINATOR',
        'INSTITUTIONAL_OFFICE',
        'ACCREDITOR_LINK'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'DEPT_STAFF',
    department      VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    must_change_pw  BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
