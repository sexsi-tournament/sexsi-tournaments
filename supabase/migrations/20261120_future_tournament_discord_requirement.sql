-- Future tournament registration requires a linked Discord account.
-- CUP #001 intentionally remains on its existing, separate registration flow.

create or replace function public.sexsi_register_for_future_tournament(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_discord_user_id text;
  v_player_id text;
  v_status text;
  v_max_players integer;
  v_deadline timestamptz;
  v_registration_key text;
  v_count integer;
begin
  if v_user_id is null then
    return 'not_logged_in';
  end if;

  if p_tournament_id is null then
    return 'invalid_tournament';
  end if;

  if p_tournament_id = '7c6f2c43-b25d-4a44-a991-4495126e78b1'::uuid then
    return 'legacy_tournament';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tournament_id::text, 0)
  );

  select p.discord_user_id, p.player_id
    into v_discord_user_id, v_player_id
  from public.profiles p
  where p.id = v_user_id;

  if nullif(pg_catalog.btrim(coalesce(v_discord_user_id, '')), '') is null then
    return 'discord_not_linked';
  end if;

  if public.sexsi_is_player_blocked(v_user_id) then
    return 'blocked';
  end if;

  select t.status, t.max_players, t.registration_deadline
    into v_status, v_max_players, v_deadline
  from public.tournaments t
  where t.id = p_tournament_id;

  if not found or v_status is distinct from 'open' then
    return 'closed';
  end if;

  v_registration_key := p_tournament_id::text;

  if exists (
    select 1
    from public.tournament_registrations r
    where r.user_id = v_user_id
      and r.tournament_id = v_registration_key
  ) then
    return 'already_registered';
  end if;

  if v_deadline is not null and now() > v_deadline then
    return 'deadline_passed';
  end if;

  if nullif(pg_catalog.btrim(coalesce(v_player_id, '')), '') is null then
    return 'missing_player_id';
  end if;

  select count(*) into v_count
  from public.tournament_registrations r
  where r.tournament_id = v_registration_key;

  if v_count >= coalesce(v_max_players, 0) then
    return 'full';
  end if;

  insert into public.tournament_registrations (id, tournament_id, user_id, created_at)
  values (gen_random_uuid(), v_registration_key, v_user_id, now());

  return 'registered';
end;
$function$;

revoke all on function public.sexsi_register_for_future_tournament(uuid) from public;
revoke all on function public.sexsi_register_for_future_tournament(uuid) from anon;
grant execute on function public.sexsi_register_for_future_tournament(uuid) to authenticated;

comment on function public.sexsi_register_for_future_tournament(uuid)
is 'Registers the authenticated SEXSI player for a future tournament only; requires a linked Discord account. Leaves CUP #001 legacy registration untouched.';
