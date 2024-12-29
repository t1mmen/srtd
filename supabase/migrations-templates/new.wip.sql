CREATE OR REPLACE FUNCTION public.just_trying_shit()
returns void as $$
BEGIN
  RAISE NOTICE 'Hello, man!xxx!1';
END;
$$ language plpgsql;
