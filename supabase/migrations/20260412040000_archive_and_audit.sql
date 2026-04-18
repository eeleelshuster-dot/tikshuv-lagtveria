-- Add is_archived column for separating active and archived queries safely
ALTER TABLE public.tickets ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create audit logs for major data management operations
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and creators can view audit logs
CREATE POLICY "Staff can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'));

-- Create a secure definer function to log events so clients cannot arbitrarily mutate audit trails directly,
-- but the client CAN insert them via an authorized RPC call if needed, or we just allow insert by staff.
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'));

-- Add RLS policy allowing creators to truly DELETE tickets (needed for manual DB cleanup capability)
CREATE POLICY "Creator can permanently delete tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'creator'));

-- Storage policy for deleting attachments
CREATE POLICY "Creator can delete attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND public.has_role(auth.uid(), 'creator'));
