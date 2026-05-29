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
    department      VARCHAR(50),
    office          VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    must_change_pw  BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_department
        CHECK (department IS NULL OR department IN ('CEA', 'CMBA', 'CASE', 'CNAHS', 'CCS', 'CCJ')),
    CONSTRAINT chk_users_office
        CHECK (office IS NULL OR office IN ('QUALITY_ASSURANCE_OFFICE', 'RESEARCH_OFFICE', 'EXTENSION_OFFICE', 'REGISTRARS_OFFICE', 'LIBRARY', 'STUDENT_AFFAIRS_OFFICE', 'FACILITIES_MANAGEMENT_OFFICE', 'HUMAN_RESOURCE_OFFICE'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

CREATE TABLE IF NOT EXISTS activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_name   VARCHAR(150) NOT NULL,
    description     TEXT,
    activity_type   VARCHAR(50) NOT NULL,
    custom_activity_type VARCHAR(100),
    activity_date   DATE NOT NULL,
    department      VARCHAR(100),
    office          VARCHAR(100),
    accreditation_area VARCHAR(50),
    academic_year   VARCHAR(20) NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_activities_activity_type
        CHECK (activity_type IN ('SEMINAR', 'TRAINING', 'WORKSHOP', 'RESEARCH', 'EXTENSION', 'OUTREACH', 'MEETING', 'CONFERENCE', 'WEBINAR', 'ADMINISTRATIVE', 'OTHER')),
    CONSTRAINT chk_activities_department
        CHECK (department IS NULL OR department IN ('CEA', 'CMBA', 'CASE', 'CNAHS', 'CCS', 'CCJ')),
    CONSTRAINT chk_activities_office
        CHECK (office IS NULL OR office IN (‘QUALITY_ASSURANCE_OFFICE’, ‘RESEARCH_OFFICE’, ‘EXTENSION_OFFICE’, ‘REGISTRARS_OFFICE’, ‘LIBRARY’, ‘STUDENT_AFFAIRS_OFFICE’, ‘FACILITIES_MANAGEMENT_OFFICE’, ‘HUMAN_RESOURCE_OFFICE’)),
    CONSTRAINT chk_activities_department_or_office
        CHECK (NULLIF(TRIM(department), '') IS NOT NULL OR NULLIF(TRIM(office), '') IS NOT NULL),
    CONSTRAINT chk_activities_accreditation_area
        CHECK (accreditation_area IS NULL OR accreditation_area IN ('FACULTY', 'INSTRUCTION', 'LIBRARY', 'LABORATORIES', 'FACILITIES', 'STUDENT_SERVICES', 'RESEARCH', 'EXTENSION', 'ADMINISTRATION'))
);

CREATE INDEX IF NOT EXISTS idx_activities_activity_date ON activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_activity_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_academic_year ON activities(academic_year);

CREATE TABLE IF NOT EXISTS evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id         UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
    original_file_name  VARCHAR(255) NOT NULL,
    stored_file_name    VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_type           VARCHAR(20) NOT NULL,
    file_size           BIGINT NOT NULL,
    evidence_type       VARCHAR(50),
    related_offices     TEXT,
    tags                TEXT,
    notes               TEXT,
    uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_evidence_file_type
        CHECK (file_type IN ('PDF', 'DOCX', 'XLSX', 'JPG', 'JPEG', 'PNG')),
    CONSTRAINT chk_evidence_file_size
        CHECK (file_size > 0 AND file_size <= 10485760),
    CONSTRAINT chk_evidence_type
        CHECK (evidence_type IS NULL OR evidence_type IN ('REPORT', 'CERTIFICATE', 'ATTENDANCE_SHEET', 'PHOTO', 'MEMORANDUM', 'PRESENTATION', 'EVALUATION', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_activity_id ON evidence(activity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence(uploaded_by);

CREATE TABLE IF NOT EXISTS evidence_references (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id          UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    activity_id          UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    referenced_by_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    referenced_by_office VARCHAR(100) NOT NULL,
    accreditation_area   VARCHAR(50),
    note                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_evidence_reference_activity UNIQUE (evidence_id, activity_id),
    CONSTRAINT chk_evidence_reference_area
        CHECK (accreditation_area IS NULL OR accreditation_area IN ('FACULTY', 'INSTRUCTION', 'LIBRARY', 'LABORATORIES', 'FACILITIES', 'STUDENT_SERVICES', 'RESEARCH', 'EXTENSION', 'ADMINISTRATION'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_references_evidence_id ON evidence_references(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_references_activity_id ON evidence_references(activity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_references_referenced_by_id ON evidence_references(referenced_by_id);

CREATE TABLE IF NOT EXISTS accreditor_access (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       VARCHAR(128) NOT NULL UNIQUE,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    notes       TEXT
);

CREATE TABLE IF NOT EXISTS accreditor_access_evidence (
    access_id   UUID NOT NULL REFERENCES accreditor_access(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    PRIMARY KEY (access_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_accreditor_access_token ON accreditor_access(token);
CREATE INDEX IF NOT EXISTS idx_accreditor_access_expires_at ON accreditor_access(expires_at);
CREATE INDEX IF NOT EXISTS idx_accreditor_access_evidence_access_id ON accreditor_access_evidence(access_id);
CREATE INDEX IF NOT EXISTS idx_accreditor_access_evidence_evidence_id ON accreditor_access_evidence(evidence_id);
