ALTER TABLE public.reward_payouts
  ADD CONSTRAINT reward_payouts_tournament_id_fkey
  FOREIGN KEY (tournament_id)
  REFERENCES public.tournaments(id)
  ON DELETE RESTRICT;
