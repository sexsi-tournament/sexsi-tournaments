CREATE OR REPLACE FUNCTION private.notify_new_tournament_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'net', 'vault'
AS $function$
DECLARE
  v_hook_token text;
BEGIN
  SELECT decrypted_secret INTO v_hook_token
  FROM vault.decrypted_secrets
  WHERE name = 'sexsi_match_hook_token'
  LIMIT 1;

  IF v_hook_token IS NULL OR v_hook_token = '' THEN
    RAISE EXCEPTION 'Missing Vault secret: sexsi_match_hook_token';
  END IF;

  PERFORM net.http_post(
    url := 'https://fyxlwcoochsuzhqostpe.supabase.co/functions/v1/notify-new-registration',
    body := jsonb_build_object('record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sexsi-hook-token', v_hook_token),
    timeout_milliseconds := 10000
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tournament_registration_notify_admin ON public.tournament_registrations;
CREATE TRIGGER tournament_registration_notify_admin
AFTER INSERT ON public.tournament_registrations
FOR EACH ROW EXECUTE FUNCTION private.notify_new_tournament_registration();
