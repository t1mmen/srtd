CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello world!';
END;
$$ language plpgsql;
