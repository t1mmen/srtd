CREATE OR REPLACE FUNCTION public.test()
returns void as $$
BEGIN
  RAISE NOTICE 'Hel11lo!!';
END;
$$ language plpgsql;
