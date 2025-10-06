-- Add foreign key constraint from task_history.changed_by to profiles.user_id
ALTER TABLE public.task_history
ADD CONSTRAINT task_history_changed_by_fkey
FOREIGN KEY (changed_by)
REFERENCES public.profiles(user_id)
ON DELETE CASCADE;