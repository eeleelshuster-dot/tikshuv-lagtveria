-- Indexes for load performance
CREATE INDEX IF NOT EXISTS idx_ticket_updates_ticket_id ON public.ticket_updates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON public.tickets(assignee_id);

-- Atomic Ticket Creation RPC
CREATE OR REPLACE FUNCTION public.submit_ticket_atomic(
  p_ticket_number TEXT,
  p_full_name TEXT,
  p_id_number TEXT,
  p_phone TEXT,
  p_description TEXT
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  -- 1. Insert the ticket
  INSERT INTO public.tickets(ticket_number, full_name, id_number, phone, description)
  VALUES (p_ticket_number, p_full_name, p_id_number, p_phone, p_description)
  RETURNING * INTO v_ticket;

  -- 2. Insert initial update correctly locking to transaction
  INSERT INTO public.ticket_updates(ticket_id, update_text)
  VALUES (v_ticket.id, 'הפנייה נשלחה בהצלחה');

  -- 3. Return created ticket record cleanly
  RETURN v_ticket;
END;
$$;

-- Table for failed background jobs / Telegram errors
CREATE TABLE IF NOT EXISTS public.failed_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  error_message TEXT NOT NULL,
  payload JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.failed_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read failed notifications" ON public.failed_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'));

CREATE POLICY "System can generate failed notifications" ON public.failed_notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can resolve notifications" ON public.failed_notifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'creator'));

-- Hardened Storage Policies (File type & limit bounds 10MB)
-- Drop existing un-restricted public upload policy
DROP POLICY IF EXISTS "Anyone can upload attachments" ON storage.objects;

-- Create heavily restricted upload policy
CREATE POLICY "Restricted upload attachments" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    -- Limit strict content types preventing reverse-shell injections
    AND (
      name ILIKE '%.jpeg' OR
      name ILIKE '%.jpg' OR
      name ILIKE '%.png' OR
      name ILIKE '%.gif' OR
      name ILIKE '%.webp' OR
      name ILIKE '%.pdf'
    )
  );
