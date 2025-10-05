-- Create task_history table for audit trail
CREATE TABLE IF NOT EXISTS public.task_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- Create policies for task_history
CREATE POLICY "Users can view task history for tasks they can see"
ON public.task_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_history.task_id
  )
);

CREATE POLICY "Authenticated users can insert task history"
ON public.task_history
FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Create index for better performance
CREATE INDEX idx_task_history_task_id ON public.task_history(task_id);
CREATE INDEX idx_task_history_changed_at ON public.task_history(changed_at DESC);

-- Create function to log task changes
CREATE OR REPLACE FUNCTION public.log_task_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_history (task_id, changed_by, action_type, field_name, new_value)
    VALUES (NEW.id, NEW.created_by, 'created', 'status', NEW.status::text);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.task_history (task_id, changed_by, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, COALESCE(NEW.assigned_to, NEW.created_by), 'status_changed', 'status', OLD.status::text, NEW.status::text);
    END IF;
    
    -- Log assigned_to changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO public.task_history (task_id, changed_by, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, COALESCE(NEW.assigned_to, NEW.created_by), 'assigned', 'assigned_to', 
              COALESCE(OLD.assigned_to::text, 'unassigned'), 
              COALESCE(NEW.assigned_to::text, 'unassigned'));
    END IF;
    
    -- Log amount changes
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.task_history (task_id, changed_by, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, COALESCE(NEW.assigned_to, NEW.created_by), 'updated', 'amount', 
              COALESCE(OLD.amount::text, ''), 
              COALESCE(NEW.amount::text, ''));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task changes
CREATE TRIGGER track_task_changes
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_change();