create table if not exists public.sexsi_moderator_reports (
  id uuid primary key default gen_random_uuid(),
  moderator_user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  report_type text not null check (report_type in ('no_show','result_dispute','player_conduct','schedule_issue','suspicious_activity','other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table public.sexsi_moderator_reports enable row level security;
revoke all on table public.sexsi_moderator_reports from anon, authenticated;

create or replace function public.sexsi_moderator_get_access()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then jsonb_build_object('authorized', false)
    when exists (
      select 1 from public.sexsi_staff_members s
      where s.user_id = auth.uid() and s.status = 'active'
        and lower(trim(s.role_title)) = 'moderator'
    ) then jsonb_build_object('authorized', true, 'role', 'moderator',
      'permissions', jsonb_build_array('view_matches','submit_reports','view_own_reports'))
    else jsonb_build_object('authorized', false)
  end;
$$;

create or replace function public.sexsi_moderator_list_matches()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sexsi_staff_members s
    where s.user_id = auth.uid() and s.status = 'active'
      and lower(trim(s.role_title)) = 'moderator'
  ) then raise exception 'Нямаш активни права на модератор.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.round_number, x.match_number), '[]'::jsonb)
  into v_rows
  from (
    select m.id, m.round_number, m.match_number, m.status, m.scheduled_at,
      m.score_player1, m.score_player2, m.player1_kills, m.player1_deaths,
      m.player2_kills, m.player2_deaths, m.result_type, m.result_reason,
      t.name as tournament_name,
      coalesce(p1.username, 'Играч 1') as player1_name,
      coalesce(p2.username, 'Играч 2') as player2_name
    from public.matches m
    left join public.tournaments t on t.id = m.tournament_id
    left join public.profiles p1 on p1.id = m.player1_id
    left join public.profiles p2 on p2.id = m.player2_id
    order by m.round_number, m.match_number limit 100
  ) x;
  return v_rows;
end;
$$;

create or replace function public.sexsi_moderator_list_my_reports()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sexsi_staff_members s
    where s.user_id = auth.uid() and s.status = 'active'
      and lower(trim(s.role_title)) = 'moderator'
  ) then raise exception 'Нямаш активни права на модератор.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select r.id, r.report_type, r.details, r.status, r.created_at,
      m.round_number, m.match_number
    from public.sexsi_moderator_reports r
    join public.matches m on m.id = r.match_id
    where r.moderator_user_id = auth.uid()
    order by r.created_at desc limit 100
  ) x;
  return v_rows;
end;
$$;

create or replace function public.sexsi_moderator_submit_report(
  p_match_id uuid, p_report_type text, p_details text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sexsi_staff_members s
    where s.user_id = auth.uid() and s.status = 'active'
      and lower(trim(s.role_title)) = 'moderator'
  ) then raise exception 'Нямаш активни права на модератор.'; end if;
  if p_report_type not in ('no_show','result_dispute','player_conduct','schedule_issue','suspicious_activity','other') then
    raise exception 'Невалиден тип сигнал.';
  end if;
  if p_details is null or char_length(trim(p_details)) < 10 or char_length(p_details) > 2000 then
    raise exception 'Описанието трябва да е между 10 и 2000 символа.';
  end if;
  if not exists (select 1 from public.matches m where m.id = p_match_id) then
    raise exception 'Избраният мач не съществува.';
  end if;
  insert into public.sexsi_moderator_reports (moderator_user_id, match_id, report_type, details)
  values (auth.uid(), p_match_id, p_report_type, trim(p_details))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.sexsi_moderator_get_access() from public, anon;
revoke all on function public.sexsi_moderator_list_matches() from public, anon;
revoke all on function public.sexsi_moderator_list_my_reports() from public, anon;
revoke all on function public.sexsi_moderator_submit_report(uuid,text,text) from public, anon;
grant execute on function public.sexsi_moderator_get_access() to authenticated;
grant execute on function public.sexsi_moderator_list_matches() to authenticated;
grant execute on function public.sexsi_moderator_list_my_reports() to authenticated;
grant execute on function public.sexsi_moderator_submit_report(uuid,text,text) to authenticated;
