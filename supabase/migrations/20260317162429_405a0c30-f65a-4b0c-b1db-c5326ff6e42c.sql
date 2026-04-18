
-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN username text;
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username);

-- Function to lookup email by username (bypasses RLS for unauthenticated login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE username = p_username LIMIT 1;
$$;

-- Enable realtime on tickets table for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
