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
