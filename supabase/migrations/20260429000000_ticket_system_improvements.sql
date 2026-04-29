-- Update Enums
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commander';
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'forwarded';

-- Drop ticket_attachments table entirely as file uploads are removed
DROP TABLE IF EXISTS public.ticket_attachments CASCADE;

-- Update tickets table
ALTER TABLE public.tickets DROP COLUMN IF EXISTS id_number CASCADE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_closed_confirmed BOOLEAN DEFAULT false;

-- Clean up rate limits table since id_number is removed
ALTER TABLE public.ticket_rate_limits DROP COLUMN IF EXISTS id_number CASCADE;

-- Recreate submit_ticket_atomic with new schema
CREATE OR REPLACE FUNCTION public.submit_ticket_atomic(
  p_ticket_number TEXT,
  p_full_name TEXT,
  p_department TEXT,
  p_phone TEXT,
  p_description TEXT
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets;
  v_ip TEXT;
  v_payload_hash TEXT;
  v_recent_ip_count INT;
  v_recent_identity_count INT;
  v_identical_payload_count INT;
BEGIN
  -- Extract IP securely internally from Supabase's HTTP proxy header 
  BEGIN
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'unknown';
  END;
  
  -- Create deterministic payload hash to reject double-clicks
  v_payload_hash := md5(p_full_name || p_department || p_phone || p_description);

  -- RULE 1: IP Rate Limiting (Max 4 requests per minute entirely)
  SELECT count(*) INTO v_recent_ip_count 
  FROM public.ticket_rate_limits 
  WHERE ip_address = v_ip AND created_at > now() - interval '1 minute';
  
  IF v_recent_ip_count >= 4 THEN
    RAISE EXCEPTION 'RATE_LIMIT:IP';
  END IF;

  -- RULE 2: Identifier 5-Minute Cooldown (Spamming same phone limit)
  SELECT count(*) INTO v_recent_identity_count 
  FROM public.ticket_rate_limits 
  WHERE phone = p_phone AND created_at > now() - interval '5 minutes';
  
  IF v_recent_identity_count >= 1 THEN
    RAISE EXCEPTION 'RATE_LIMIT:IDENTITY';
  END IF;

  -- RULE 3: Exact Identical Payload Block (Network lag double-submit 30 seconds)
  SELECT count(*) INTO v_identical_payload_count
  FROM public.ticket_rate_limits
  WHERE payload_hash = v_payload_hash AND created_at > now() - interval '30 seconds';

  IF v_identical_payload_count >= 1 THEN
    RAISE EXCEPTION 'RATE_LIMIT:DUPLICATE';
  END IF;

  -- Log the attempt (even if it subsequently fails natively)
  INSERT INTO public.ticket_rate_limits(ip_address, phone, payload_hash)
  VALUES (v_ip, p_phone, v_payload_hash);

  -- CORE: Insert the ticket
  INSERT INTO public.tickets(ticket_number, full_name, department, phone, description)
  VALUES (p_ticket_number, p_full_name, p_department, p_phone, p_description)
  RETURNING * INTO v_ticket;

  -- CORE: Insert initial update
  INSERT INTO public.ticket_updates(ticket_id, update_text)
  VALUES (v_ticket.id, 'הפנייה נשלחה בהצלחה');

  RETURN v_ticket;
END;
$$;

-- Create Trigger Function to Enforce Status Flow
CREATE OR REPLACE FUNCTION public.enforce_ticket_status_fsm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allowed full flow: sent -> in_progress -> forwarded -> resolved -> closed
    -- Admin shortcut: sent -> in_progress -> resolved -> closed
    IF OLD.status = 'sent' AND NEW.status != 'in_progress' THEN
      RAISE EXCEPTION 'Invalid status transition from sent to %', NEW.status;
    ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('forwarded', 'resolved') THEN
      RAISE EXCEPTION 'Invalid status transition from in_progress to %', NEW.status;
    ELSIF OLD.status = 'forwarded' AND NEW.status != 'resolved' THEN
      RAISE EXCEPTION 'Invalid status transition from forwarded to %', NEW.status;
    ELSIF OLD.status = 'resolved' AND NEW.status != 'closed' THEN
      RAISE EXCEPTION 'Invalid status transition from resolved to %', NEW.status;
    ELSIF OLD.status = 'closed' THEN
      RAISE EXCEPTION 'Ticket is closed and cannot change status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_status_fsm_trigger ON public.tickets;
CREATE TRIGGER ticket_status_fsm_trigger
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ticket_status_fsm();

-- Create RPC for public users to confirm ticket closure
CREATE OR REPLACE FUNCTION public.confirm_ticket_closure_public(p_ticket_number TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  v_ticket_id UUID;
BEGIN
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = p_ticket_number AND status = 'closed' AND is_closed_confirmed = false;
  
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found or cannot be confirmed';
  END IF;

  UPDATE public.tickets SET is_closed_confirmed = true WHERE id = v_ticket_id;

  INSERT INTO public.ticket_updates(ticket_id, update_text)
  VALUES (v_ticket_id, '????? ?????? ????? ?? ??? ?????');
END;
;
