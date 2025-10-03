-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "All authenticated users can view tasks" ON public.tasks;

-- Create new policy: Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'Admin'::app_role));

-- Create new policy: Members can only view tasks assigned to them
CREATE POLICY "Members can view their assigned tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Member'::app_role) 
  AND assigned_to = auth.uid()
);