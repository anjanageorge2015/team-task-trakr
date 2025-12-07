-- First, update any existing data to use the new category values
UPDATE public.expenses SET category = 'other' WHERE category NOT IN ('travel', 'other');

-- Create a new enum type with the desired values
CREATE TYPE expense_category_new AS ENUM ('travel', 'petrol', 'office_expense', 'other');

-- Alter the column to use the new enum (need to cast through text)
ALTER TABLE public.expenses 
  ALTER COLUMN category TYPE expense_category_new 
  USING category::text::expense_category_new;

-- Drop the old enum type
DROP TYPE expense_category;

-- Rename the new enum to the original name
ALTER TYPE expense_category_new RENAME TO expense_category;