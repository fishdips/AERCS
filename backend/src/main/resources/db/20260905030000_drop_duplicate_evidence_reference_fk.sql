-- The 20260905000000 migration added evidence_references_referenced_by_id_fkey
-- (ON DELETE SET NULL) but never dropped the original Hibernate-generated
-- constraint on the same column, which still had NO ACTION. With both present,
-- Postgres enforced the stricter one too, so deleting a user who had submitted
-- an evidence reference could still fail intermittently.

ALTER TABLE evidence_references DROP CONSTRAINT IF EXISTS fkki9wgb15db53qyw9tqx42oomv;
