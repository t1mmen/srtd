-- Generated with srtd from template: supabase/migrations-templates/experiment.sql
-- You very likely **DO NOT** want to manually edit this generated file.

BEGIN;

CREATE OR REPLACE FUNCTION public.my_experiment()
RETURNS text LANGUAGE sql AS $$ SELECT 'testing'; $$;


COMMIT;
-- Last built: Never
-- Built with https://github.com/t1mmen/srtd
