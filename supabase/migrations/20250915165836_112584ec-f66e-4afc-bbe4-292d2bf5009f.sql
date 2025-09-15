-- Create sequence for SCS ID starting from 1000
CREATE SEQUENCE IF NOT EXISTS scs_id_seq START WITH 1000 INCREMENT BY 1;

-- Add a function to generate SCS ID
CREATE OR REPLACE FUNCTION generate_scs_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SCS' || LPAD(nextval('scs_id_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update tasks table to auto-generate scs_id
ALTER TABLE public.tasks ALTER COLUMN scs_id SET DEFAULT generate_scs_id();