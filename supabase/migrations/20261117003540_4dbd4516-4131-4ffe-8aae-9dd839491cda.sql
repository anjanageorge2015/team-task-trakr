ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'Others';

CREATE OR REPLACE FUNCTION public.validate_expense_payment_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_type NOT IN ('UPI', 'Others') THEN
    RAISE EXCEPTION 'Payment Type must be UPI or Others';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_expense_payment_type_trigger ON public.expenses;
CREATE TRIGGER validate_expense_payment_type_trigger
  BEFORE INSERT OR UPDATE OF payment_type ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_payment_type();