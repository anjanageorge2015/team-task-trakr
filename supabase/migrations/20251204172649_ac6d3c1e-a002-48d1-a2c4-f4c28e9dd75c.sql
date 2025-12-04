-- Create advances table to track individual advance payments
CREATE TABLE public.advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_user_id uuid NOT NULL,
  advance_date date NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all advances" 
ON public.advances 
FOR ALL 
USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own advances" 
ON public.advances 
FOR SELECT 
USING (auth.uid() = employee_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_advances_updated_at
BEFORE UPDATE ON public.advances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();