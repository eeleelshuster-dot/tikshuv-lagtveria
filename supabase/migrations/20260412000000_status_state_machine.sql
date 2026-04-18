-- Prevent completely invalid arbitrary state jumps for tracking status

CREATE OR REPLACE FUNCTION public.check_ticket_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If status hasn't changed, allow it
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allow logical forward progression
  IF OLD.status = 'sent' AND NEW.status IN ('in_progress', 'closed') THEN
    RETURN NEW;
  END IF;
  
  IF OLD.status = 'in_progress' AND NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;
  
  IF OLD.status = 'resolved' AND NEW.status = 'closed' THEN
    RETURN NEW;
  END IF;

  -- Allow reversing status if an admin made a mistake (e.g., reopened)
  IF NEW.status = 'in_progress' AND OLD.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

CREATE TRIGGER enforce_valid_status_transition
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_ticket_status_transition();
