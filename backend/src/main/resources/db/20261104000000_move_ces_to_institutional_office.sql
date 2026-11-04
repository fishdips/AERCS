-- CES (Community Extension Service) moves from the Departments list to the Institutional
-- Offices. Existing records are re-pointed at the new COMMUNITY_EXTENSION_SERVICE office.
UPDATE users SET office = 'COMMUNITY_EXTENSION_SERVICE' WHERE office = 'CES';

UPDATE activities
SET office = 'COMMUNITY_EXTENSION_SERVICE', department = NULL
WHERE department = 'CES';

UPDATE activities SET office = 'COMMUNITY_EXTENSION_SERVICE' WHERE office = 'CES';

-- Evidence tags are stored as comma-separated text; CES was never a taggable value.
