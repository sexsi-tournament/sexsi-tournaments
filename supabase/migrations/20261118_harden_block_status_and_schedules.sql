CREATE OR REPLACE FUNCTION public.sexsi_is_player_blocked(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF p_user_id IS DISTINCT FROM auth.uid()
     AND auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.sexsi_blocked_players WHERE blocked_user_id = p_user_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sexsi_is_player_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sexsi_is_player_blocked(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sexsi_get_public_match_schedules()
RETURNS TABLE(match_id uuid, scheduled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT m.id, m.scheduled_at
  FROM public.matches m
  WHERE m.scheduled_at IS NOT NULL
    AND m.tournament_id = '7c6f2c43-b25d-4a44-a991-4495126e78b1'::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.check_tournament_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  max_count integer;
  current_count integer;
  tournament_status text;
BEGIN
  SELECT max_players, status INTO max_count, tournament_status
  FROM public.tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF tournament_status <> 'open' THEN
    RAISE EXCEPTION 'Tournament is not open for registration';
  END IF;
  SELECT COUNT(*) INTO current_count FROM public.registrations
  WHERE tournament_id = NEW.tournament_id AND status IN ('pending', 'approved');
  IF current_count >= max_count THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  RETURN NEW;
END;
$function$;
