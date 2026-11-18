-- Prerequisite: provision the secret "sexsi_match_hook_token" in Supabase Vault.
-- Do not store the token value in source control.
CREATE OR REPLACE FUNCTION private.enqueue_match_schedule_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'net', 'vault'
AS $function$
DECLARE
  v_hook_token text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    UPDATE public.matches
       SET schedule_email_status = 'not_sent',
           schedule_email_sent_to = '{}',
           schedule_email_sent_at = NULL,
           schedule_email_error = NULL
     WHERE id = NEW.id;
  END IF;

  IF NEW.scheduled_at IS NOT NULL
     AND NEW.player1_id IS NOT NULL
     AND NEW.player2_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_hook_token
    FROM vault.decrypted_secrets
    WHERE name = 'sexsi_match_hook_token'
    LIMIT 1;

    IF v_hook_token IS NULL OR v_hook_token = '' THEN
      RAISE EXCEPTION 'Missing Vault secret: sexsi_match_hook_token';
    END IF;

    PERFORM net.http_post(
      url := 'https://fyxlwcoochsuzhqostpe.supabase.co/functions/v1/notify-match-scheduled',
      body := jsonb_build_object('match_id', NEW.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sexsi-hook-token', v_hook_token),
      timeout_milliseconds := 10000
    );
  END IF;
  RETURN NEW;
END;
$function$;
