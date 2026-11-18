-- SEXSI TOURNAMENTS: насрочване на дата и час за всеки двубой
-- Изпълни този файл в Supabase SQL Editor.

alter table public.matches
  add column if not exists scheduled_at timestamptz;

create or replace function public.sexsi_admin_set_match_schedule(
  p_match_id uuid,
  p_scheduled_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid then
    raise exception 'Нямаш права за тази операция.';
  end if;

  if p_scheduled_at is null then
    raise exception 'Избери дата и час за двубоя.';
  end if;

  update public.matches
  set scheduled_at = p_scheduled_at
  where id = p_match_id;

  if not found then
    raise exception 'Двубоят не беше намерен.';
  end if;

  return 'Датата и часът за двубоя са запазени успешно.';
end;
$$;

revoke all on function public.sexsi_admin_set_match_schedule(uuid, timestamptz) from public;
grant execute on function public.sexsi_admin_set_match_schedule(uuid, timestamptz) to authenticated;


-- Публично четими са само насрочените дати и часове, без лични данни.
create or replace function public.sexsi_get_public_match_schedules()
returns table(match_id uuid, scheduled_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select m.id, m.scheduled_at
  from public.matches as m
  where m.scheduled_at is not null;
$$;

revoke all on function public.sexsi_get_public_match_schedules() from public;
grant execute on function public.sexsi_get_public_match_schedules() to anon, authenticated;
