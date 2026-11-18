ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;

UPDATE public.tournaments
SET name = 'SEXSI 1V1 CUP #001',
    start_at = timestamp '2026-12-02 00:00:00' AT TIME ZONE 'Europe/Sofia',
    registration_deadline = timestamp '2026-11-25 23:59:59' AT TIME ZONE 'Europe/Sofia'
WHERE id = '7c6f2c43-b25d-4a44-a991-4495126e78b1'::uuid;

CREATE OR REPLACE FUNCTION public.sexsi_register_for_tournament()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  participant_count integer;
  current_user_id uuid := auth.uid();
  v_status text;
  v_max_players integer;
  v_deadline timestamptz;
BEGIN
  IF current_user_id IS NULL THEN RETURN 'not_logged_in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('SEXSI-1V1-001', 0));

  IF public.sexsi_is_player_blocked(current_user_id) THEN RETURN 'blocked'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_registrations
    WHERE user_id = current_user_id AND tournament_id = 'SEXSI-1V1-001'
  ) THEN RETURN 'already_registered'; END IF;

  SELECT status, max_players, registration_deadline
  INTO v_status, v_max_players, v_deadline
  FROM public.tournaments
  WHERE id = '7c6f2c43-b25d-4a44-a991-4495126e78b1'::uuid;

  IF NOT FOUND OR v_status IS DISTINCT FROM 'open' THEN RETURN 'closed'; END IF;
  IF v_deadline IS NOT NULL AND now() > v_deadline THEN RETURN 'deadline_passed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_user_id AND NULLIF(BTRIM(player_id), '') IS NOT NULL
  ) THEN RETURN 'missing_player_id'; END IF;

  SELECT COUNT(*) INTO participant_count
  FROM public.tournament_registrations
  WHERE tournament_id = 'SEXSI-1V1-001';

  IF participant_count >= v_max_players THEN RETURN 'full'; END IF;

  INSERT INTO public.tournament_registrations (id, tournament_id, user_id, created_at)
  VALUES (gen_random_uuid(), 'SEXSI-1V1-001', current_user_id, now());

  RETURN 'registered';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_set_my_player_id(p_player_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Необходим е вход в акаунта'; END IF;

  IF EXISTS (SELECT 1 FROM public.tournament_registrations WHERE user_id = v_user_id)
     OR EXISTS (SELECT 1 FROM public.matches WHERE player1_id = v_user_id OR player2_id = v_user_id) THEN
    RAISE EXCEPTION 'Game ID не може да се променя след записване за турнир или създаване на турнирна схема.';
  END IF;

  UPDATE public.profiles
  SET player_id = NULLIF(BTRIM(p_player_id), '')
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Профилът не е намерен'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_award_bracket_match_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.winner_id IS NOT NULL
     AND NEW.player1_id IS NOT NULL
     AND NEW.player2_id IS NOT NULL
  THEN
    PERFORM public.sexsi_award_xp(
      NEW.winner_id, 100, 'match_win', 'bracket_match_win:' || NEW.id::text
    );
    PERFORM public.sexsi_award_xp(
      CASE WHEN NEW.winner_id = NEW.player1_id THEN NEW.player2_id ELSE NEW.player1_id END,
      40, 'match_loss', 'bracket_match_loss:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_admin_remove_registration(p_registration_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RAISE EXCEPTION 'Нямате администраторски достъп';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.tournament_registrations
  WHERE id = p_registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Регистрацията не е намерена'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE tournament_id = '7c6f2c43-b25d-4a44-a991-4495126e78b1'::uuid
  ) THEN
    RAISE EXCEPTION 'Регистрация не може да бъде изтрита след създаване на турнирната схема.';
  END IF;

  DELETE FROM public.tournament_registrations WHERE id = p_registration_id;
  RETURN true;
END;
$function$;

NOTIFY pgrst, 'reload schema';
