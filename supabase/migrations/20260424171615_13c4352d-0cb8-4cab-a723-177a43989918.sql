-- Drop and recreate the UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "All authenticated users can update tasks" ON public.tasks;

CREATE POLICY "All authenticated users can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);