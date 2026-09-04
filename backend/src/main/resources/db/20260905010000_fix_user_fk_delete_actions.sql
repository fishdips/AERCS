-- The live database's FK constraints on users.created_by, activities.created_by,
-- evidence.uploaded_by, and accreditor_access.created_by were created by an early
-- Hibernate ddl-auto=update run, before any @OnDelete annotations existed, so they
-- have no ON DELETE action (defaults to blocking) even though schema.sql documents
-- ON DELETE SET NULL. ddl-auto=update never rewrites an existing constraint, so this
-- mismatch persisted silently. Realign them so deleting a user detaches (rather than
-- blocks on, or cascades into) content they created/uploaded elsewhere in the app.

ALTER TABLE users DROP CONSTRAINT IF EXISTS fkibk1e3kaxy5sfyeekp8hbhnim;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_created_by_fkey;
ALTER TABLE users ADD CONSTRAINT users_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS fkexq3sblvj77fqtr4ucioqowsc;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_created_by_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE evidence DROP CONSTRAINT IF EXISTS fk8yev7msejt3l6dbfn2nucy0lt;
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_uploaded_by_fkey;
ALTER TABLE evidence ADD CONSTRAINT evidence_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE accreditor_access DROP CONSTRAINT IF EXISTS fkh436ey84lj5t084hy4ix2gbmo;
ALTER TABLE accreditor_access DROP CONSTRAINT IF EXISTS accreditor_access_created_by_fkey;
ALTER TABLE accreditor_access ADD CONSTRAINT accreditor_access_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
