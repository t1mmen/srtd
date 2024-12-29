CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello, World!!!!!';
END;
$$ language plpgsql;
