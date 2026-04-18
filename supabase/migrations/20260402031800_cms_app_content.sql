-- Migration to support Global Copy Management and Audit Logs
CREATE TABLE public.app_content (
  key TEXT PRIMARY KEY,
  value_draft TEXT,
  value_published TEXT NOT NULL,
  placement_rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content text changes log for auditing and version control
CREATE TABLE public.content_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT REFERENCES public.app_content(key) ON DELETE CASCADE NOT NULL,
  previous_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL -- 'draft' or 'published'
);

ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_audit_log ENABLE ROW LEVEL SECURITY;

-- Only 'creator' role has ALL permissions on app_content
CREATE POLICY "Creator can manage app_content" ON public.app_content
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'creator'))
  WITH CHECK (public.has_role(auth.uid(), 'creator'));

-- Anyone (anon + authenticated) can read app_content (required for the app to display text!)
CREATE POLICY "Anyone can read app_content" ON public.app_content
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only 'creator' role has ALL permissions on content_audit_log
CREATE POLICY "Creator can manage content_audit_log" ON public.content_audit_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'creator'))
  WITH CHECK (public.has_role(auth.uid(), 'creator'));

-- Triggers to update timestamps
CREATE TRIGGER update_app_content_updated_at
  BEFORE UPDATE ON public.app_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert core initial texts (we will add more later)
INSERT INTO public.app_content (key, value_published) VALUES
('home_hero_title', 'מערכת ניהול פניות מתקדמת'),
('home_hero_subtitle', 'שירות מהיר, יעיל ומקצועי לכל פנייה'),
('login_admin_button', 'כניסת מנהל'),
('admin_login_title', 'כניסת מנהל');
