-- Create employee_salaries table for storing salary information
CREATE TABLE public.employee_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_user_id UUID NOT NULL,
  monthly_salary NUMERIC NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

-- Admins can manage all employee salaries
CREATE POLICY "Admins can manage all employee salaries" 
ON public.employee_salaries 
FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role));

-- Users can view their own salary
CREATE POLICY "Users can view their own salary" 
ON public.employee_salaries 
FOR SELECT 
USING (auth.uid() = employee_user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_salaries_updated_at
BEFORE UPDATE ON public.employee_salaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();