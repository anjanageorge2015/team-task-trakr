CREATE TABLE public.vehicle_income (
  id uuid not null default gen_random_uuid() primary key,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  income_date date not null default CURRENT_DATE,
  amount numeric not null default 0,
  source text not null default 'trip',
  description text,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_income TO authenticated;
GRANT ALL ON public.vehicle_income TO service_role;
ALTER TABLE public.vehicle_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage vehicle income" ON public.vehicle_income FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));
CREATE TRIGGER update_vehicle_income_updated_at BEFORE UPDATE ON public.vehicle_income
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();