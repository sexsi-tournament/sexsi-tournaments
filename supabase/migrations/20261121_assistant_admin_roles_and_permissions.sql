-- Scoped assistant administrator role for SEXSI TOURNAMENTS.
-- The owner remains the only account allowed to create tournaments and manage roles.

create table if not exists public.sexsi_admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'assistant_admin' check (role = 'assistant_admin'),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now()
);
alter table public.sexsi_admin_roles enable row level security;
revoke all on public.sexsi_admin_roles from anon, authenticated;

create table if not exists public.sexsi_admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  row_id text,
  created_at timestamptz not null default now()
);
alter table public.sexsi_admin_audit_log enable row level security;
revoke all on public.sexsi_admin_audit_log from anon, authenticated;

create or replace function public.sexsi_has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
    or (
      exists (select 1 from public.sexsi_admin_roles r
              where r.user_id = auth.uid() and r.role = 'assistant_admin')
      and p_permission = any (array[
        'view_dashboard','manage_registrations','manage_players','view_discord',
        'manage_matches','manage_rewards','view_analytics','manage_news',
        'publish_discord','send_emails'
      ]::text[])
    );
$$;
revoke all on function public.sexsi_has_admin_permission(text) from public, anon;
grant execute on function public.sexsi_has_admin_permission(text) to authenticated;

create or replace function public.sexsi_admin_get_access()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_owner boolean := auth.uid() = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid;
  v_assistant boolean := exists (select 1 from public.sexsi_admin_roles r where r.user_id = auth.uid() and r.role = 'assistant_admin');
begin
  if not (v_owner or v_assistant) then
    return jsonb_build_object('authorized', false, 'role', 'player', 'permissions', '[]'::jsonb);
  end if;
  if v_owner then
    return jsonb_build_object('authorized', true, 'role', 'owner',
      'permissions', jsonb_build_array('view_dashboard','manage_registrations','manage_players','view_discord','manage_matches','manage_rewards','view_analytics','manage_news','publish_discord','send_emails','manage_admins','view_audit','create_tournaments','system_settings','delete_tournaments'));
  end if;
  return jsonb_build_object('authorized', true, 'role', 'assistant_admin',
    'permissions', jsonb_build_array('view_dashboard','manage_registrations','manage_players','view_discord','manage_matches','manage_rewards','view_analytics','manage_news','publish_discord','send_emails'));
end;
$$;
revoke all on function public.sexsi_admin_get_access() from public, anon;
grant execute on function public.sexsi_admin_get_access() to authenticated;

create or replace function public.sexsi_admin_user_directory()
returns table(user_id uuid, email text, username text)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then raise exception 'Нямате право да управлявате администратори.'; end if;
  return query
  select u.id, u.email::text, coalesce(nullif(trim(p.username), ''), nullif(trim(u.raw_user_meta_data->>'username'), ''), 'PLAYER')::text
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id <> '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  order by lower(coalesce(p.username, u.email::text));
end;
$$;

create or replace function public.sexsi_admin_list_assistants()
returns table(user_id uuid, email text, username text, assigned_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then raise exception 'Нямате право да управлявате администратори.'; end if;
  return query
  select r.user_id, u.email::text, coalesce(nullif(trim(p.username), ''), nullif(trim(u.raw_user_meta_data->>'username'), ''), 'PLAYER')::text, r.assigned_at
  from public.sexsi_admin_roles r join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  order by r.assigned_at desc;
end;
$$;

create or replace function public.sexsi_admin_assign_assistant(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then raise exception 'Само собственикът може да назначава помощник администратори.'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'Избери валиден потребител.'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then raise exception 'Потребителят не е намерен.'; end if;
  insert into public.sexsi_admin_roles(user_id, role, assigned_by)
  values (p_user_id, 'assistant_admin', auth.uid())
  on conflict (user_id) do update set role = excluded.role, assigned_by = auth.uid(), assigned_at = now();
  return true;
end;
$$;

create or replace function public.sexsi_admin_revoke_assistant(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then raise exception 'Само собственикът може да премахва помощник администратори.'; end if;
  delete from public.sexsi_admin_roles where user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.sexsi_admin_user_directory() from public, anon;
revoke all on function public.sexsi_admin_list_assistants() from public, anon;
revoke all on function public.sexsi_admin_assign_assistant(uuid) from public, anon;
revoke all on function public.sexsi_admin_revoke_assistant(uuid) from public, anon;
grant execute on function public.sexsi_admin_user_directory() to authenticated;
grant execute on function public.sexsi_admin_list_assistants() to authenticated;
grant execute on function public.sexsi_admin_assign_assistant(uuid) to authenticated;
grant execute on function public.sexsi_admin_revoke_assistant(uuid) to authenticated;

create or replace function public.sexsi_admin_audit_trigger()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_row jsonb; v_id text;
begin
  if auth.uid() is not null and public.sexsi_has_admin_permission('view_dashboard') then
    v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    v_id := coalesce(v_row->>'id', v_row->>'user_id', v_row->>'blocked_user_id', v_row->>'match_id');
    insert into public.sexsi_admin_audit_log(actor_user_id, action, table_name, row_id)
    values (auth.uid(), tg_op, tg_table_name, v_id);
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.sexsi_admin_audit_trigger() from public, anon, authenticated;

drop trigger if exists sexsi_admin_audit_matches on public.matches;
create trigger sexsi_admin_audit_matches after insert or update or delete on public.matches for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_registrations on public.tournament_registrations;
create trigger sexsi_admin_audit_registrations after insert or update or delete on public.tournament_registrations for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_profiles on public.profiles;
create trigger sexsi_admin_audit_profiles after update on public.profiles for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_blocked_players on public.sexsi_blocked_players;
create trigger sexsi_admin_audit_blocked_players after insert or update or delete on public.sexsi_blocked_players for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_rewards on public.reward_payouts;
create trigger sexsi_admin_audit_rewards after insert or update or delete on public.reward_payouts for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_news on public.sexsi_news;
create trigger sexsi_admin_audit_news after insert or update or delete on public.sexsi_news for each row execute function public.sexsi_admin_audit_trigger();
drop trigger if exists sexsi_admin_audit_roles on public.sexsi_admin_roles;
create trigger sexsi_admin_audit_roles after insert or update or delete on public.sexsi_admin_roles for each row execute function public.sexsi_admin_audit_trigger();

create or replace function public.sexsi_admin_audit_list()
returns table(id bigint, actor_user_id uuid, action text, table_name text, row_id text, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then raise exception 'Само собственикът може да преглежда административния дневник.'; end if;
  return query select l.id, l.actor_user_id, l.action, l.table_name, l.row_id, l.created_at from public.sexsi_admin_audit_log l order by l.created_at desc limit 200;
end;
$$;
revoke all on function public.sexsi_admin_audit_list() from public, anon;
grant execute on function public.sexsi_admin_audit_list() to authenticated;

do $$
declare r record; v_def text; v_permission text; v_original text;
begin
  for r in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'sexsi_admin_add_match','sexsi_admin_add_match_v2','sexsi_admin_analytics',
        'sexsi_admin_block_player','sexsi_admin_create_reward','sexsi_admin_discord_stats',
        'sexsi_admin_generate_bracket','sexsi_admin_manage_players','sexsi_admin_mark_reward_sent',
        'sexsi_admin_players','sexsi_admin_registrations','sexsi_admin_remove_registration',
        'sexsi_admin_rewards','sexsi_admin_set_forfeit_result','sexsi_admin_set_match_schedule',
        'sexsi_admin_submit_bracket_result','sexsi_admin_submit_bracket_result_v2',
        'sexsi_admin_unblock_player','sexsi_admin_update_player_id','sexsi_is_player_blocked'
      )
  loop
    v_permission := case
      when r.proname = 'sexsi_admin_analytics' then 'view_analytics'
      when r.proname = 'sexsi_admin_discord_stats' then 'view_discord'
      when r.proname in ('sexsi_admin_block_player','sexsi_admin_manage_players','sexsi_admin_players','sexsi_admin_unblock_player','sexsi_admin_update_player_id','sexsi_is_player_blocked') then 'manage_players'
      when r.proname in ('sexsi_admin_registrations','sexsi_admin_remove_registration') then 'manage_registrations'
      when r.proname in ('sexsi_admin_create_reward','sexsi_admin_mark_reward_sent','sexsi_admin_rewards') then 'manage_rewards'
      else 'manage_matches'
    end;
    v_def := pg_get_functiondef(r.oid);
    v_original := v_def;
    if r.proname = 'sexsi_admin_registrations' then
      v_def := replace(v_def, 'WHERE auth.uid() = ''13f1ada8-cd05-4c31-8940-4fb1790cb90e''::uuid',
        'WHERE public.sexsi_has_admin_permission(''manage_registrations'')');
    else
      v_def := regexp_replace(v_def,
        'auth[.]uid[(][)][[:space:]]+is distinct from[[:space:]]+''13f1ada8-cd05-4c31-8940-4fb1790cb90e''::uuid',
        'NOT public.sexsi_has_admin_permission(''' || v_permission || ''')', 'gi');
    end if;
    if v_def = v_original then raise exception 'Could not replace admin guard in function %', r.proname; end if;
    execute v_def;
  end loop;
end;
$$;

drop policy if exists sexsi_admin_manage_blocked on public.sexsi_blocked_players;
create policy sexsi_admin_manage_blocked on public.sexsi_blocked_players for all to authenticated
using (public.sexsi_has_admin_permission('manage_players'))
with check (public.sexsi_has_admin_permission('manage_players'));

drop policy if exists "SEXSI admin can manage news" on public.sexsi_news;
create policy "SEXSI admin can manage news" on public.sexsi_news for all to authenticated
using (public.sexsi_has_admin_permission('manage_news'))
with check (public.sexsi_has_admin_permission('manage_news'));

drop policy if exists "Authors and admin can delete comments" on public.sexsi_news_comments;
create policy "Authors and admin can delete comments" on public.sexsi_news_comments for delete to authenticated
using (user_id = auth.uid() or public.sexsi_has_admin_permission('manage_news'));

drop policy if exists sexsi_admin_view_all on public.tournament_registrations;
create policy sexsi_admin_view_all on public.tournament_registrations for select to authenticated
using (public.sexsi_has_admin_permission('manage_registrations'));
