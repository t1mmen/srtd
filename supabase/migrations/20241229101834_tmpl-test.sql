-- Generated from template: supabase/migrations-templates/test.sql
-- You very likely **DO NOT** want to manually edit this generated file.

BEGIN;
CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello, World!!!!!';
END;
$$ language plpgsql;

COMMIT;

-- Last built: Never