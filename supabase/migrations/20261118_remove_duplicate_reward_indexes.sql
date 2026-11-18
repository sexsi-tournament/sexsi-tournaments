-- The unique index on tournament_id already supports lookups.
DROP INDEX IF EXISTS public.reward_payouts_unique_tournament;
DROP INDEX IF EXISTS public.reward_payouts_tournament_idx;
