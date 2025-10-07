-- Drop the existing policy that allows all authenticated users to delete tasks
DROP POLICY IF EXISTS "All authenticated users can delete tasks" ON public.tasks;

-- Create new policy that only allows admins to delete tasks
CREATE POLICY "Only admins can delete tasks" 
ON public.tasks 
FOR DELETE 
USING (has_role(auth.uid(), 'Admin'::app_role));