-- These triggers invoke the private Vault-authenticated email enqueue function.
DROP TRIGGER IF EXISTS matches_notify_schedule_insert ON public.matches;
CREATE TRIGGER matches_notify_schedule_insert
AFTER INSERT ON public.matches
FOR EACH ROW
WHEN (NEW.scheduled_at IS NOT NULL)
EXECUTE FUNCTION private.enqueue_match_schedule_email();

DROP TRIGGER IF EXISTS matches_notify_schedule_update ON public.matches;
CREATE TRIGGER matches_notify_schedule_update
AFTER UPDATE OF scheduled_at ON public.matches
FOR EACH ROW
WHEN (NEW.scheduled_at IS NOT NULL AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at)
EXECUTE FUNCTION private.enqueue_match_schedule_email();
