-- Migration: Remove technician role from app_role enum
BEGIN;

-- 1. Promote any existing technicians to admin
UPDATE public.profiles SET role = 'admin' WHERE role::text = 'technician';
UPDATE public.user_roles SET role = 'admin' WHERE role::text = 'technician';

-- 2. Handle the enum change
-- Create a temporary type
CREATE TYPE public.app_role_new AS ENUM ('creator', 'admin');

-- Alter the profiles table to use the new type
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE public.app_role_new 
  USING (role::text::public.app_role_new);

-- Alter the user_roles table to use the new type
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role_new 
  USING (role::text::public.app_role_new);

-- Drop the old type
DROP TYPE public.app_role;

-- Rename the new type to the old name
ALTER TYPE public.app_role_new RENAME TO app_role;

COMMIT;
