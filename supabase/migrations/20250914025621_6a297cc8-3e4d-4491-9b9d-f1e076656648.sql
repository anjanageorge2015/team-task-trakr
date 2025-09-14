-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('unassigned', 'assigned', 'on_hold', 'closed', 'settled');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table for dropdown
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table with all required fields
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scs_id TEXT NOT NULL,
  vendor_call_id TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  call_description TEXT NOT NULL,
  call_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  remarks TEXT,
  scs_remarks TEXT,
  amount DECIMAL(10,2),
  status public.task_status NOT NULL DEFAULT 'unassigned',
  assigned_to UUID REFERENCES public.profiles(user_id),
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for vendors
CREATE POLICY "All authenticated users can view vendors" 
ON public.vendors 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can manage vendors" 
ON public.vendors 
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create RLS policies for tasks
CREATE POLICY "All authenticated users can view tasks" 
ON public.tasks 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can create tasks" 
ON public.tasks 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "All authenticated users can update tasks" 
ON public.tasks 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can delete tasks" 
ON public.tasks 
FOR DELETE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Insert some sample vendors
INSERT INTO public.vendors (name, contact_info) VALUES
('TechCorp Solutions', 'tech@techcorp.com'),
('Global Services Ltd', 'contact@globalservices.com'),
('Prime Vendors Inc', 'info@primevendors.com'),
('Elite Partners', 'support@elitepartners.com'),
('Metro Solutions', 'hello@metrosolutions.com');