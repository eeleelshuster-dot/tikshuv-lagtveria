
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('creator', 'admin');

-- Enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('sent', 'in_progress', 'resolved', 'closed');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'admin',
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  id_number TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status ticket_status NOT NULL DEFAULT 'sent',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Ticket updates/timeline
CREATE TABLE public.ticket_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  update_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_updates ENABLE ROW LEVEL SECURITY;

-- Ticket attachments metadata
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins/creators can read all profiles
CREATE POLICY "Staff can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'));

-- Creator can manage profiles
CREATE POLICY "Creator can manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'creator'))
  WITH CHECK (public.has_role(auth.uid(), 'creator'));

-- User roles: only creator can manage
CREATE POLICY "Creator can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'creator'))
  WITH CHECK (public.has_role(auth.uid(), 'creator'));

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tickets: anyone can insert (public submission)
CREATE POLICY "Anyone can create tickets" ON public.tickets
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Public can read their own ticket by ticket_number (handled in app via anon)
CREATE POLICY "Anyone can read tickets by number" ON public.tickets
  FOR SELECT TO anon, authenticated
  USING (true);

-- Staff can update tickets
CREATE POLICY "Staff can update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'technician'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator') OR public.has_role(auth.uid(), 'technician'));

-- Ticket updates: public read, staff write
CREATE POLICY "Anyone can read ticket updates" ON public.ticket_updates
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "System can insert ticket updates" ON public.ticket_updates
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Ticket attachments: public read, anyone insert
CREATE POLICY "Anyone can read attachments" ON public.ticket_attachments
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create attachments" ON public.ticket_attachments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false);

-- Storage RLS
CREATE POLICY "Anyone can upload attachments" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Anyone can read attachments" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ticket-attachments');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
