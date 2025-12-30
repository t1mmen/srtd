-- Generated with srtd from template: supabase/migrations-templates/new_feature.sql
-- You very likely **DO NOT** want to manually edit this generated file.

BEGIN;

-- Get user email by ID
-- Simple utility function for looking up user emails

CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

COMMENT ON FUNCTION public.get_user_email IS 'Returns email address for a given user ID';


COMMIT;
-- Last built: Never
-- Built with https://github.com/t1mmen/srtd
