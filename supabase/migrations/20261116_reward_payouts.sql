-- SEXSI TOURNAMENTS: награди и изплащания
-- Без промени по matches, profiles, регистрации или турнирната схема.
-- Изпълнява се еднократно в Supabase SQL Editor.

create table if not exists public.reward_payouts (
  id uuid primary key default gen_random_uuid(),
  tournament_name text not null,
  final_match_id uuid not null references public.matches(id) on delete restrict,
  winner_user_id uuid not null references auth.users(id) on delete restrict,
  winner_game_name text not null,
  winner_game_id text not null,
  reward_amount integer not null default 5000 check (reward_amount > 0),
  reward_currency text not null default 'Gold',
  handed_over_at timestamptz not null default now(),
  proof_path text,
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation','confirmed')),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint reward_confirmation_consistency check (
    (status = 'awaiting_confirmation' and confirmed_at is null and confirmed_by is null)
    or (status = 'confirmed' and confirmed_at is not null and confirmed_by = winner_user_id)
  ),
  constraint reward_one_payout_per_final_match unique (final_match_id)
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

-- Replace the earlier draft RPC, if it was created.
drop function if exists public.sexsi_admin_create_reward_payout(text,uuid,text,text,integer,text,timestamptz);

create or replace function public.sexsi_admin_create_reward_payout(
  p_tournament_name text,
  p_final_match_id uuid,
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
set search_path = ''
as $$
declare
  v_payout_id uuid;
  v_profile_name text;
  v_profile_game_id text;
  v_tournament_id constant uuid := '7c6f2c43-b25d-4a44-a991-4495126e78b1';
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then
    raise exception 'Нямаш права за тази операция.';
  end if;

  if nullif(trim(p_tournament_name), '') is null
     or nullif(trim(p_winner_game_name), '') is null
     or nullif(trim(p_winner_game_id), '') is null
     or p_final_match_id is null
     or p_winner_user_id is null
     or p_reward_amount is null or p_reward_amount <= 0 then
    raise exception 'Попълни турнира, шампиона, Game ID и валидна награда.';
  end if;

  if p_tournament_name <> 'SEXSI 1V1 CUP #001' then
    raise exception 'Невалиден турнир за тази награда.';
  end if;

  -- Server-side validation: only the completed final match champion is eligible.
  if not exists (
    select 1
    from public.matches m
    where m.id = p_final_match_id
      and m.tournament_id = v_tournament_id
      and m.round_number = (
        select max(mx.round_number)
        from public.matches mx
        where mx.tournament_id = v_tournament_id
      )
      and m.status = 'completed'
      and m.winner_id = p_winner_user_id
  ) then
    raise exception 'Награда може да се запише само за шампиона от завършения финал.';
  end if;

  select p.username, p.player_id
    into v_profile_name, v_profile_game_id
  from public.profiles p
  where p.id = p_winner_user_id;

  if not found
     or v_profile_name is distinct from trim(p_winner_game_name)
     or v_profile_game_id is distinct from trim(p_winner_game_id) then
    raise exception 'Името или Game ID не съвпадат с профила на шампиона.';
  end if;

  insert into public.reward_payouts (
    tournament_name, final_match_id, winner_user_id,
    winner_game_name, winner_game_id, reward_amount,
    proof_path, handed_over_at, created_by
  ) values (
    trim(p_tournament_name), p_final_match_id, p_winner_user_id,
    trim(p_winner_game_name), trim(p_winner_game_id), p_reward_amount,
    p_proof_path, coalesce(p_handed_over_at, now()), auth.uid()
  )
  returning id into v_payout_id;

  return v_payout_id;
end;
$$;

create or replace function public.sexsi_confirm_reward_received(p_payout_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Трябва да влезеш в профила си.';
  end if;

  update public.reward_payouts
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = auth.uid()
   where id = p_payout_id
     and winner_user_id = auth.uid()
     and status = 'awaiting_confirmation';

  if not found then
    raise exception 'Наградата не е намерена, вече е потвърдена или не принадлежи на този профил.';
  end if;

  return 'Получаването на наградата е потвърдено.';
end;
$$;

revoke all on function public.sexsi_admin_create_reward_payout(text,uuid,uuid,text,text,integer,text,timestamptz) from public;
grant execute on function public.sexsi_admin_create_reward_payout(text,uuid,uuid,text,text,integer,text,timestamptz) to authenticated;
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
