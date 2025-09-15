-- Fix function search path for security
CREATE OR REPLACE FUNCTION generate_scs_id()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'SCS' || LPAD(nextval('scs_id_seq')::text, 4, '0');
END;
$$;