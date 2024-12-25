-- Generated from template: supabase/migrations-templates/test.sql
-- **DO NOT** manually edit this file.

BEGIN;
CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello, World!!!';
END;
$$ language plpgsql;

COMMIT;

-- Last built: 2024-12-25T07:00:53.089Z