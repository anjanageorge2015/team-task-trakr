-- Schedule the payroll generation function to run on the 10th of each month at 3:30 AM UTC
SELECT cron.schedule(
  'generate-monthly-payroll',
  '30 3 10 * *',
  $$
  SELECT
    net.http_post(
        url:='https://dmwnmyfvpdzlahrawlmk.supabase.co/functions/v1/generate-monthly-payroll',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtd25teWZ2cGR6bGFocmF3bG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MTc2NjcsImV4cCI6MjA3MzM5MzY2N30.GaDyN4eGONFywMHgYjWdG_npNS5zOi6Hv1LMTp0qmB0'
        ),
        body:='{}'::jsonb
    ) AS request_id;
  $$
);