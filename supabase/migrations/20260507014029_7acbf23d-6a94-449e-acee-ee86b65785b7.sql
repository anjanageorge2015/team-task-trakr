
-- Profiles: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

-- Expenses: replace public-read with owner-or-admin read
DROP POLICY IF EXISTS "Users can view all expenses" ON public.expenses;
CREATE POLICY "Users can view their own expenses"
ON public.expenses FOR SELECT TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'Admin'::app_role));

-- Task attachments: require auth
DROP POLICY IF EXISTS "Users can view task attachments" ON public.task_attachments;
CREATE POLICY "Authenticated users can view task attachments"
ON public.task_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id));

DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON public.task_attachments;
CREATE POLICY "Authenticated users can upload attachments"
ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.task_attachments;
CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by);

-- Task history: require auth
DROP POLICY IF EXISTS "Users can view task history for tasks they can see" ON public.task_history;
CREATE POLICY "Authenticated users can view task history"
ON public.task_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id));

DROP POLICY IF EXISTS "Authenticated users can insert task history" ON public.task_history;
CREATE POLICY "Authenticated users can insert task history"
ON public.task_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- Tasks: restrict UPDATE to admins or assignee
DROP POLICY IF EXISTS "All authenticated users can update tasks" ON public.tasks;
CREATE POLICY "Admins or assignee can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role) OR assigned_to = auth.uid())
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role) OR assigned_to = auth.uid());

-- Trigger: only admins can change sensitive fields on tasks
CREATE OR REPLACE FUNCTION public.enforce_task_admin_only_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'Admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage THEN
    RAISE EXCEPTION 'Only admins can change commission_percentage';
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Only admins can change amount';
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Only admins can reassign tasks';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change task creator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_admin_only_fields_trigger ON public.tasks;
CREATE TRIGGER enforce_task_admin_only_fields_trigger
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_admin_only_fields();

-- Storage: enforce folder ownership on task-attachments uploads
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;

CREATE POLICY "Users upload task attachments to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
