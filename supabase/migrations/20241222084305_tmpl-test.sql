-- Generated from template: /supabase/migrations-templates/test.sql
-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file
-- **DO NOT** write any manual migrations to change any SQL from this file

BEGIN;

-- Just a sample
-- lol22
-- 2222
-- 3333

CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello, World!';
END;
$$ language plpgsql;


COMMIT;

-- **ONLY** use the migration template + yarn db:migration:build to adjust ANY SQL in this file
-- **DO NOT** write any manual migrations to change any SQL from this file
-- Last built: 2024-12-22T08:19:33.553Z