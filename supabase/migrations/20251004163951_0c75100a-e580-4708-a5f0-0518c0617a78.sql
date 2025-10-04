-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-attachments', 'task-attachments', false);

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on task_attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments
CREATE POLICY "Users can view task attachments"
  ON public.task_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
    )
  );

CREATE POLICY "Authenticated users can upload attachments"
  ON public.task_attachments
  FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
  ON public.task_attachments
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Storage policies for task-attachments bucket
CREATE POLICY "Users can view task attachment files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload task attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own attachment files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);