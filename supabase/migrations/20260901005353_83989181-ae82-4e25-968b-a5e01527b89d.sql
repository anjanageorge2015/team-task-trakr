ALTER TABLE public.vehicles ADD COLUMN maintenance_cost numeric DEFAULT 0;

COMMENT ON COLUMN public.vehicles.maintenance_cost IS 'Recorded upkeep/maintenance cost for the vehicle';

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;