-- Generated with srtd from template: supabase/migrations-templates/srtd_demo_greet.sql
-- You very likely **DO NOT** want to manually edit this generated file.

BEGIN;

-- Greeting function for SRTD demo
-- This function returns a personalized greeting message

CREATE OR REPLACE FUNCTION public.greet(name text DEFAULT 'World')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'Hello, ' || name || '!';
END;
$$;

COMMENT ON FUNCTION public.greet IS 'Returns a friendly greeting message';


COMMIT;
-- Last built: Never
-- Built with https://github.com/t1mmen/srtd
