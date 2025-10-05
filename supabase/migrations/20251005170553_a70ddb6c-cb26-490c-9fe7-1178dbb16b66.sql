-- Add 'repeat' status to the task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'repeat';