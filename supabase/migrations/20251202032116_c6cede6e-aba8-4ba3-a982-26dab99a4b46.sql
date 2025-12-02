-- Create expense categories enum
CREATE TYPE public.expense_category AS ENUM (
  'travel',
  'supplies',
  'services',
  'equipment',
  'utilities',
  'maintenance',
  'other'
);

-- Create expense status enum
CREATE TYPE public.expense_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'paid'
);

-- Create payroll status enum
CREATE TYPE public.payroll_status AS ENUM (
  'draft',
  'approved',
  'paid'
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expense_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  receipt_url TEXT,
  status expense_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create payroll table
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  employee_user_id UUID NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary NUMERIC NOT NULL CHECK (base_salary >= 0),
  bonuses NUMERIC DEFAULT 0 CHECK (bonuses >= 0),
  deductions NUMERIC DEFAULT 0 CHECK (deductions >= 0),
  net_pay NUMERIC GENERATED ALWAYS AS (base_salary + bonuses - deductions) STORED,
  payment_date DATE,
  status payroll_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expenses
CREATE POLICY "Admins can manage all expenses"
  ON public.expenses
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view all expenses"
  ON public.expenses
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their pending expenses"
  ON public.expenses
  FOR UPDATE
  USING (auth.uid() = created_by AND status = 'pending');

-- RLS Policies for payroll
CREATE POLICY "Admins can manage all payroll"
  ON public.payroll
  FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can view their own payroll"
  ON public.payroll
  FOR SELECT
  USING (auth.uid() = employee_user_id);

-- Triggers for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_updated_at
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();