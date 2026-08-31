CREATE TYPE public.vehicle_type AS ENUM ('two_wheeler', 'four_wheeler');

CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number text NOT NULL UNIQUE,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'two_wheeler',
  make_model text,
  owner_name text,
  insurance_expiry date,
  puc_expiry date,
  fitness_expiry date,
  permit_expiry date,
  road_tax_expiry date,
  next_service_due date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicles"
ON public.vehicles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'Admin'::app_role));

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();