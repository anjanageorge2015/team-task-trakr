CREATE TABLE public.vehicle_service_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  service_type text NOT NULL DEFAULT 'general_service',
  odometer_reading numeric,
  garage_name text,
  description text,
  invoice_number text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_service_expenses TO authenticated;
GRANT ALL ON public.vehicle_service_expenses TO service_role;

ALTER TABLE public.vehicle_service_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vehicle service expenses"
ON public.vehicle_service_expenses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE INDEX idx_vehicle_service_expenses_vehicle ON public.vehicle_service_expenses(vehicle_id);
CREATE INDEX idx_vehicle_service_expenses_date ON public.vehicle_service_expenses(service_date);

CREATE TRIGGER update_vehicle_service_expenses_updated_at
BEFORE UPDATE ON public.vehicle_service_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();