-- Generated with srtd from template: supabase/migrations-templates/srtd_demo_audit.sql
-- You very likely **DO NOT** want to manually edit this generated file.

BEGIN;

-- Audit trigger function for SRTD demo
-- Automatically tracks created_at and updated_at timestamps

CREATE OR REPLACE FUNCTION public.set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_timestamps IS 'Trigger function to auto-update timestamp columns';


COMMIT;
-- Last built: Never
-- Built with https://github.com/t1mmen/srtd
