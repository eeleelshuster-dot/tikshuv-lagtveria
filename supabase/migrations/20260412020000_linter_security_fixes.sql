-- Fix: "rls_policy_always_true"
-- Because we securely encapsulated the creation of tickets into `submit_ticket_atomic` RPC (which runs as SECURITY DEFINER),
-- we no longer want or need the public API to allow direct table INSERTS globally!
-- Dropping this locks hackers out from natively pushing to `tickets` and `ticket_updates` via the POST endpoint directly.

DROP POLICY IF EXISTS "Anyone can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "System can insert ticket updates" ON public.ticket_updates;

-- Fixing the failed_notifications table:
-- Since notify-telegram triggers it via the edge function, we can securely force that insertion to only occur if authenticated or from the Edge proxy.
-- However, an easier fix is simply to drop the "true" check and use the service role key internally inside the Edge Function.
DROP POLICY IF EXISTS "System can generate failed notifications" ON public.failed_notifications;

-- (Make sure Edge Function uses SUPABASE_SERVICE_ROLE_KEY to bypass this newly locked RLS, meaning anonymous users can never spoof logs).
