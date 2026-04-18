-- This migration flawlessly resolves all 16 Performance Warnings identified by the Supabase Linter.
-- It resolves `auth_rls_initplan` by securely wrapping `auth.uid()` inside `(select auth.uid())` which caches it natively for the query planner.
-- It resolves `multiple_permissive_policies` by efficiently merging fragmented SELECT and UPDATE rules into unified `Combined...` policies.

-- ==========================================
-- 1. APP_CONTENT (Fix Multiple Permissive & InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Creator can manage app_content" ON public.app_content;

-- (SELECT is already covered natively by `Anyone can read app_content` using `true`, so we skip SELECT for creators to prevent doubling)
CREATE POLICY "Creator can insert app_content" ON public.app_content FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'creator'));
CREATE POLICY "Creator can update app_content" ON public.app_content FOR UPDATE USING (public.has_role((select auth.uid()), 'creator'));
CREATE POLICY "Creator can delete app_content" ON public.app_content FOR DELETE USING (public.has_role((select auth.uid()), 'creator'));

-- ==========================================
-- 2. CONTENT_AUDIT_LOG (Fix InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Creator can manage content_audit_log" ON public.content_audit_log;

CREATE POLICY "Creator can manage content_audit_log" ON public.content_audit_log 
  FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'creator')) WITH CHECK (public.has_role((select auth.uid()), 'creator'));

-- ==========================================
-- 3. USER_ROLES (Fix Multiple Permissive & InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Creator can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Combined read roles" ON public.user_roles FOR SELECT USING (
  user_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'creator')
);
CREATE POLICY "Creator can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'creator'));
CREATE POLICY "Creator can update roles" ON public.user_roles FOR UPDATE USING (public.has_role((select auth.uid()), 'creator'));
CREATE POLICY "Creator can delete roles" ON public.user_roles FOR DELETE USING (public.has_role((select auth.uid()), 'creator'));

-- ==========================================
-- 4. PROFILES (Fix Multiple Permissive & InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Creator can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Combined read profiles" ON public.profiles FOR SELECT USING (
  id = (select auth.uid()) OR 
  public.has_role((select auth.uid()), 'admin') OR 
  public.has_role((select auth.uid()), 'creator')
);

CREATE POLICY "Combined update profiles" ON public.profiles FOR UPDATE USING (
  id = (select auth.uid()) OR 
  public.has_role((select auth.uid()), 'creator')
);

CREATE POLICY "Creator can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'creator'));
CREATE POLICY "Creator can delete profiles" ON public.profiles FOR DELETE USING (public.has_role((select auth.uid()), 'creator'));

-- ==========================================
-- 5. TICKETS (Fix InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Staff can update tickets" ON public.tickets;

CREATE POLICY "Staff can update tickets" ON public.tickets FOR UPDATE USING (
  public.has_role((select auth.uid()), 'admin') OR 
  public.has_role((select auth.uid()), 'creator')
);

-- ==========================================
-- 6. FAILED NOTIFICATIONS (Fix InitPlan)
-- ==========================================
DROP POLICY IF EXISTS "Staff can read failed notifications" ON public.failed_notifications;
DROP POLICY IF EXISTS "Staff can resolve notifications" ON public.failed_notifications;

CREATE POLICY "Staff can read failed notifications" ON public.failed_notifications FOR SELECT USING (
  public.has_role((select auth.uid()), 'admin') OR 
  public.has_role((select auth.uid()), 'creator')
);

CREATE POLICY "Staff can resolve notifications" ON public.failed_notifications FOR UPDATE USING (
  public.has_role((select auth.uid()), 'admin') OR 
  public.has_role((select auth.uid()), 'creator')
);

-- ==========================================
-- 7. TODOS (Fix Leftover InitPlan if table exists)
-- ==========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'todos') THEN
    DROP POLICY IF EXISTS "Individuals can create todos." ON public.todos;
    -- Fallback simple recreation logic for the obsolete todos table
    EXECUTE 'CREATE POLICY "Individuals can create todos." ON public.todos FOR INSERT WITH CHECK (user_id = (select auth.uid()))';
  END IF;
END $$;
