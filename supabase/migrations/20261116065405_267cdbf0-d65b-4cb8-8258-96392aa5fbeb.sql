CREATE TABLE public.user_payment_details (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  upi_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_details TO authenticated;
GRANT ALL ON public.user_payment_details TO service_role;
ALTER TABLE public.user_payment_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user payment details"
  ON public.user_payment_details
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'Admin'::public.app_role));
CREATE TRIGGER update_user_payment_details_updated_at
  BEFORE UPDATE ON public.user_payment_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();