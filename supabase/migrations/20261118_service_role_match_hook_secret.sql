CREATE OR REPLACE FUNCTION public.sexsi_get_match_hook_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $function$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'sexsi_match_hook_token'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.sexsi_get_match_hook_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_get_match_hook_token() TO service_role;
