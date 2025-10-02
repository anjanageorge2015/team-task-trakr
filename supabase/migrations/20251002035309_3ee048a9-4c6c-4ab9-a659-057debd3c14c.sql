-- Update the app_role enum to use 'Member' instead of 'Engineer'
ALTER TYPE app_role RENAME VALUE 'Engineer' TO 'Member';

-- Update any existing 'Engineer' roles to 'Member' (this will happen automatically with the enum rename)