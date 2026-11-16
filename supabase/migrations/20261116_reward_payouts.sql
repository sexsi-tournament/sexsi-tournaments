-- SEXSI TOURNAMENTS: регистър на наградите
-- Изпълни целия файл в Supabase SQL Editor.
-- Снимките се качват в private bucket sexsi-reward-proofs.

create table if not exists public.reward_payouts (
  id uuid primary key default gen_random_uuid(),
  tournament_name text not null,
  winner_user_id uuid not null references auth.users(id) on delete restrict,
  winner_game_name text not null,
  winner_game_id text not null,
  reward_amount integer not null check (reward_amount > 0),
  reward_currency text not null default 'Gold',
  handed_over_at timestamptz not null default now(),
  proof_path text,
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation','confirmed')),
  confirmed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint reward_confirmation_consistency check (
    (status = 'awaiting_confirmation' and confirmed_at is null)
    or (status = 'confirmed' and confirmed_at is not null)
  )
);

create index if not exists reward_payouts_winner_idx
  on public.reward_payouts(winner_user_id, created_at desc);

alter table public.reward_payouts enable row level security;

drop policy if exists "Users can view their own reward payouts" on public.reward_payouts;
create policy "Users can view their own reward payouts"
  on public.reward_payouts for select to authenticated
  using (
    winner_user_id = auth.uid()
    or auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  );

revoke all on public.reward_payouts from anon, authenticated;
grant select on public.reward_payouts to authenticated;

create or replace function public.sexsi_admin_create_reward_payout(
  p_tournament_name text,
  p_winner_user_id uuid,
  p_winner_game_name text,
  p_winner_game_id text,
  p_reward_amount integer default 5000,
  p_proof_path text default null,
  p_handed_over_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then
    raise exception 'Нямаш права за тази операция.';
  end if;
  if nullif(trim(p_tournament_name), '') is null
     or nullif(trim(p_winner_game_name), '') is null
     or nullif(trim(p_winner_game_id), '') is null
     or p_winner_user_id is null
     or p_reward_amount is null or p_reward_amount <= 0 then
    raise exception 'Попълни турнира, победителя, Game ID и валидна награда.';
  end if;

  insert into public.reward_payouts (
    tournament_name, winner_user_id, winner_game_name, winner_game_id,
    reward_amount, proof_path, handed_over_at
  ) values (
    trim(p_tournament_name), p_winner_user_id, trim(p_winner_game_name),
    trim(p_winner_game_id), p_reward_amount, p_proof_path, p_handed_over_at
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sexsi_confirm_reward_received(p_payout_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reward_payouts
     set status = 'confirmed', confirmed_at = now()
   where id = p_payout_id
     and winner_user_id = auth.uid()
     and status = 'awaiting_confirmation';
  if not found then
    raise exception 'Наградата не е намерена, вече е потвърдена или не принадлежи на този профил.';
  end if;
  return 'Получаването на наградата е потвърдено.';
end;
$$;

revoke all on function public.sexsi_admin_create_reward_payout(text,uuid,text,text,integer,text,timestamptz) from public;
grant execute on function public.sexsi_admin_create_reward_payout(text,uuid,text,text,integer,text,timestamptz) to authenticated;
revoke all on function public.sexsi_confirm_reward_received(uuid) from public;
grant execute on function public.sexsi_confirm_reward_received(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('sexsi-reward-proofs', 'sexsi-reward-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Admin uploads reward proofs" on storage.objects;
create policy "Admin uploads reward proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sexsi-reward-proofs'
    and auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  );

drop policy if exists "Admin reads reward proofs" on storage.objects;
create policy "Admin reads reward proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sexsi-reward-proofs'
    and auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  );
