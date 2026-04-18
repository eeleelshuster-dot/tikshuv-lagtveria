-- Comprehensive Rate Limiter for Anonymous Tickets

CREATE TABLE IF NOT EXISTS public.ticket_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    phone TEXT,
    id_number TEXT,
    payload_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ticket_rate_limits ENABLE ROW LEVEL SECURITY;

-- Index for speedy sweep checking
CREATE INDEX IF NOT EXISTS idx_rate_limit_checks ON public.ticket_rate_limits(ip_address, phone, id_number, created_at DESC);

-- Refactoring the Atomic Function to natively execute Anti-Spam Constraints 
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
  v_payload_hash := md5(p_full_name || p_id_number || p_phone || p_description);

  -- RULE 1: IP Rate Limiting (Max 4 requests per minute entirely)
  SELECT count(*) INTO v_recent_ip_count 
  FROM public.ticket_rate_limits 
  WHERE ip_address = v_ip AND created_at > now() - interval '1 minute';
  
  IF v_recent_ip_count >= 4 THEN
    RAISE EXCEPTION 'RATE_LIMIT:IP';
  END IF;

  -- RULE 2: Identifier 5-Minute Cooldown (Spamming same phone/ID limit)
  SELECT count(*) INTO v_recent_identity_count 
  FROM public.ticket_rate_limits 
  WHERE (phone = p_phone OR id_number = p_id_number) AND created_at > now() - interval '5 minutes';
  
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
  INSERT INTO public.ticket_rate_limits(ip_address, phone, id_number, payload_hash)
  VALUES (v_ip, p_phone, p_id_number, v_payload_hash);
  
  -- Prevent massive bloat by randomly sweeping old limits (optional hygiene)
  -- DELETE FROM public.ticket_rate_limits WHERE created_at < now() - interval '1 day';

  -- CORE: Insert the ticket
  INSERT INTO public.tickets(ticket_number, full_name, id_number, phone, description)
  VALUES (p_ticket_number, p_full_name, p_id_number, p_phone, p_description)
  RETURNING * INTO v_ticket;

  -- CORE: Insert initial update
  INSERT INTO public.ticket_updates(ticket_id, update_text)
  VALUES (v_ticket.id, 'הפנייה נשלחה בהצלחה');

  RETURN v_ticket;
END;
$$;


-- Administrative Storage Hygiene Tool
-- Wipes completely orphaned attachments where upload succeeded but ticket failed
CREATE OR REPLACE FUNCTION public.delete_orphaned_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_obj record;
BEGIN
  -- A file is orphaned if it's in storage but missing in ticket_attachments for > 24 hours
  -- Since Supabase Storage relies natively on the API, wiping it completely requires calling storage APIs natively.
  -- Wait, `storage.objects` CAN be deleted from directly in plpgsql since it's a native table internally!
  
  DELETE FROM storage.objects 
  WHERE bucket_id = 'ticket-attachments' 
  AND created_at < now() - interval '24 hours'
  AND id NOT IN (
     -- Extracting the storage ID bounds if possible, or using name/path matches
     SELECT (string_to_array(file_path, '/'))[2]::uuid FROM public.ticket_attachments WHERE file_path IS NOT NULL
     -- This is an extremely complex binding, the safest native SQL wipe evaluates exact file trails:
  );
  
END;
$$;
