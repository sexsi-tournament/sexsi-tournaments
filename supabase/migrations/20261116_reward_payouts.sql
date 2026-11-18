-- SEXSI TOURNAMENTS: live reward payout schema.
-- This replaces the earlier draft schema; it matches the production reward_payouts table and reward-proofs bucket.

CREATE TABLE IF NOT EXISTS public.reward_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE RESTRICT,
  winner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  game_id text,
  reward_amount integer NOT NULL DEFAULT 5000,
  reward_currency text NOT NULL DEFAULT 'Gold',
  status text NOT NULL DEFAULT 'pending',
  proof_path text,
  admin_note text,
  created_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  confirmed_at timestamptz,
  CONSTRAINT reward_amount_valid CHECK (reward_amount > 0),
  CONSTRAINT reward_payouts_status_check CHECK (status IN ('pending','sent','confirmed','cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS reward_payouts_one_per_tournament
  ON public.reward_payouts(tournament_id);
CREATE INDEX IF NOT EXISTS reward_payouts_winner_idx
  ON public.reward_payouts(winner_id);

ALTER TABLE public.reward_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_select_own ON public.reward_payouts;
CREATE POLICY reward_select_own ON public.reward_payouts
  FOR SELECT TO authenticated USING (winner_id = auth.uid());

DROP POLICY IF EXISTS reward_confirm_own ON public.reward_payouts;
CREATE POLICY reward_confirm_own ON public.reward_payouts
  FOR UPDATE TO authenticated
  USING (winner_id = auth.uid() AND status = 'sent')
  WITH CHECK (
    winner_id = auth.uid()
    AND status = 'confirmed'
    AND confirmed_by = auth.uid()
    AND confirmed_at IS NOT NULL
  );

REVOKE ALL ON public.reward_payouts FROM anon, authenticated;
GRANT SELECT ON public.reward_payouts TO authenticated;

CREATE OR REPLACE FUNCTION public.sexsi_admin_create_reward(p_tournament_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_match_count integer;
  v_winner_id uuid;
  v_game_id text;
  v_reward_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reward_payouts WHERE tournament_id = p_tournament_id) THEN
    RAISE EXCEPTION 'Reward already exists for this tournament';
  END IF;

  SELECT COUNT(*) INTO v_match_count
  FROM public.matches
  WHERE tournament_id = p_tournament_id
    AND round_number = (SELECT MAX(round_number) FROM public.matches WHERE tournament_id = p_tournament_id);

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'Final round must contain exactly one match';
  END IF;

  SELECT m.winner_id, p.player_id INTO v_winner_id, v_game_id
  FROM public.matches m
  JOIN public.profiles p ON p.id = m.winner_id
  WHERE m.tournament_id = p_tournament_id
    AND m.round_number = (SELECT MAX(round_number) FROM public.matches WHERE tournament_id = p_tournament_id)
    AND m.status = 'completed'
    AND m.winner_id IS NOT NULL;

  IF v_winner_id IS NULL THEN
    RAISE EXCEPTION 'Final match is not completed or winner is missing';
  END IF;

  INSERT INTO public.reward_payouts (
    tournament_id, winner_id, game_id, reward_amount, reward_currency, status, created_by
  ) VALUES (
    p_tournament_id, v_winner_id, v_game_id, 5000, 'Gold', 'pending', auth.uid()
  ) RETURNING id INTO v_reward_id;

  RETURN v_reward_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_admin_mark_reward_sent(p_reward_id uuid, p_proof_path text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.reward_payouts
  SET status = 'sent', proof_path = p_proof_path, sent_at = now()
  WHERE id = p_reward_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found or already processed'; END IF;
  RETURN 'Reward marked as sent';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_admin_rewards()
RETURNS TABLE(
  reward_id uuid, tournament_id uuid, winner_id uuid, username text, player_id text,
  reward_amount integer, reward_currency text, reward_status text, proof_path text,
  created_at timestamptz, sent_at timestamptz, confirmed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT r.id, r.tournament_id, r.winner_id, p.username, p.player_id,
    r.reward_amount, r.reward_currency, r.status, r.proof_path,
    r.created_at, r.sent_at, r.confirmed_at
  FROM public.reward_payouts r
  JOIN public.profiles p ON p.id = r.winner_id
  ORDER BY r.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_confirm_reward(p_reward_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  UPDATE public.reward_payouts
  SET status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  WHERE id = p_reward_id AND winner_id = auth.uid() AND status = 'sent';

  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found or not available for confirmation'; END IF;
  RETURN 'Reward successfully confirmed';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sexsi_get_my_reward()
RETURNS TABLE(
  reward_id uuid, tournament_id uuid, reward_amount integer, reward_currency text,
  reward_status text, game_id text, proof_path text, created_at timestamptz,
  sent_at timestamptz, confirmed_at timestamptz
)
LANGUAGE sql SET search_path = ''
AS $function$
  SELECT r.id, r.tournament_id, r.reward_amount, r.reward_currency, r.status,
    r.game_id, r.proof_path, r.created_at, r.sent_at, r.confirmed_at
  FROM public.reward_payouts r
  WHERE r.winner_id = auth.uid()
  ORDER BY r.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.sexsi_admin_create_reward(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_admin_mark_reward_sent(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_admin_rewards() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_confirm_reward(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_get_my_reward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sexsi_admin_create_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_admin_mark_reward_sent(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_admin_rewards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_confirm_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_get_my_reward() TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reward-proofs', 'reward-proofs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS reward_proofs_admin_all ON storage.objects;
CREATE POLICY reward_proofs_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'reward-proofs' AND auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid)
  WITH CHECK (bucket_id = 'reward-proofs' AND auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid);

DROP POLICY IF EXISTS reward_proofs_read_own ON storage.objects;
CREATE POLICY reward_proofs_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reward-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS reward_proofs_upload_own ON storage.objects;
CREATE POLICY reward_proofs_upload_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reward-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
