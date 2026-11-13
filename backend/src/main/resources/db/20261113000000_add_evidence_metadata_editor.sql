-- Migration: Record who last edited an evidence record's metadata (type, offices, tags, notes).
-- Lets staff and chairpersons see "last edited by <name> on <date>", so a chairperson
-- overriding staff-entered metadata is traceable.
--
-- Both columns are nullable: existing records show nothing until their metadata is next saved.
-- `updated_at` is not reused because it also changes when a file is replaced or a link is edited.
--
-- The application's `ddl-auto=update` setting adds these columns on startup; this file is for
-- databases that are migrated by hand.

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS metadata_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS metadata_updated_at TIMESTAMPTZ;
