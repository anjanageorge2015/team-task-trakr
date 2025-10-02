-- Assign Admin role to sajutmathew2004@gmail.com
INSERT INTO public.user_roles (user_id, role, created_by)
VALUES ('92782188-d6ee-4ed0-8c4a-f369813c712d', 'Admin', '92782188-d6ee-4ed0-8c4a-f369813c712d')
ON CONFLICT (user_id, role) DO NOTHING;