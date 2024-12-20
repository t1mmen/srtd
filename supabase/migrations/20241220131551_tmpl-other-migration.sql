-- Generated from template: /supabase/migrations-templates/other-migration.sql
-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file
-- **DO NOT** write any manual migrations to change any SQL from this file

BEGIN;

-- Nothing here yet
CREATE TABLE users (
  id bigint PRIMARY KEY,
  name text
);


COMMIT;

-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file
-- **DO NOT** write any manual migrations to change any SQL from this file
-- Last built: Never