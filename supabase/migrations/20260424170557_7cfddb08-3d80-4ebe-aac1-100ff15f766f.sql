-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function to create notifications on task changes
CREATE OR REPLACE FUNCTION public.notify_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
  task_label TEXT;
BEGIN
  actor_id := auth.uid();
  task_label := COALESCE(NEW.scs_id, 'a task');

  -- New assignment on insert
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, task_id, type, title, message)
      VALUES (NEW.assigned_to, NEW.id, 'task_assigned',
              'New task assigned',
              'Task ' || task_label || ' (' || NEW.customer_name || ') has been assigned to you.');
    END IF;
    RETURN NEW;
  END IF;

  -- Reassignment on update
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to <> COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, task_id, type, title, message)
      VALUES (NEW.assigned_to, NEW.id, 'task_assigned',
              'New task assigned',
              'Task ' || task_label || ' (' || NEW.customer_name || ') has been assigned to you.');
    END IF;

    -- Status change (notify assignee, skip if self-action or no assignee)
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to <> COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, task_id, type, title, message)
      VALUES (NEW.assigned_to, NEW.id, 'task_status_changed',
              'Task status updated',
              'Task ' || task_label || ' status changed from ' || OLD.status::text || ' to ' || NEW.status::text || '.');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_notify_changes
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_changes();