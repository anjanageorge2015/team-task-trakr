CREATE TYPE public.expense_payment_status AS ENUM ('initiated', 'paid', 'failed', 'cancelled');

CREATE TABLE public.expense_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  payee_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  recipient_upi_id text NOT NULL,
  status public.expense_payment_status NOT NULL DEFAULT 'initiated',
  bank_reference text,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.expense_payment_records TO authenticated;
GRANT ALL ON public.expense_payment_records TO service_role;
ALTER TABLE public.expense_payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view expense payment records"
  ON public.expense_payment_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'::public.app_role));
CREATE POLICY "Admins can create expense payment records"
  ON public.expense_payment_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Admin'::public.app_role));
CREATE POLICY "Admins can update expense payment records"
  ON public.expense_payment_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'Admin'::public.app_role));

CREATE TRIGGER update_expense_payment_records_updated_at
  BEFORE UPDATE ON public.expense_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();