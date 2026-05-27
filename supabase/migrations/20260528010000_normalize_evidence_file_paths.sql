UPDATE evidence
SET file_path = regexp_replace(replace(file_path, E'\\', '/'), '^.*uploads/evidence/', '')
WHERE file_path IS NOT NULL
  AND replace(file_path, E'\\', '/') LIKE '%uploads/evidence/%';
