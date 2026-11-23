
alter table public.sexsi_moderator_reports
  add column if not exists admin_note text;

alter table public.sexsi_moderator_reports
  drop constraint if exists sexsi_moderator_reports_status_check;
alter table public.sexsi_moderator_reports
  add constraint sexsi_moderator_reports_status_check
  check (status in ('pending','in_progress','reviewed','resolved','rejected'));

create or replace function public.sexsi_admin_list_moderator_reports()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_access jsonb; v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'Необходим е администраторски достъп.'; end if;
  v_access := public.sexsi_admin_get_access();
  if coalesce((v_access->>'authorized')::boolean, false) is not true
     or not coalesce((v_access->'permissions') ? 'manage_matches', false) then
    raise exception 'Нямаш право да преглеждаш сигналите.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select r.id,r.report_type,r.details,r.status,r.created_at,r.admin_note,r.reviewed_at,r.reviewed_by,
      m.id as match_id,m.round_number,m.match_number,
      coalesce(mp.username,'Модератор') as moderator_name,
      coalesce(rv.username,'—') as reviewed_by_name
    from public.sexsi_moderator_reports r
    join public.matches m on m.id=r.match_id
    left join public.profiles mp on mp.id=r.moderator_user_id
    left join public.profiles rv on rv.id=r.reviewed_by
    order by r.created_at desc limit 300
  ) x;
  return v_rows;
end;
$$;

create or replace function public.sexsi_admin_update_moderator_report(
  p_report_id uuid,p_status text,p_admin_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_access jsonb; v_row public.sexsi_moderator_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'Необходим е администраторски достъп.'; end if;
  v_access := public.sexsi_admin_get_access();
  if coalesce((v_access->>'authorized')::boolean, false) is not true
     or not coalesce((v_access->'permissions') ? 'manage_matches', false) then
    raise exception 'Нямаш право да обработваш сигнали.';
  end if;
  if p_status not in ('pending','in_progress','reviewed','resolved','rejected') then
    raise exception 'Невалиден статус на сигнала.';
  end if;
  if p_admin_note is not null and char_length(p_admin_note)>2000 then
    raise exception 'Бележката не може да надвишава 2000 символа.';
  end if;
  update public.sexsi_moderator_reports
  set status=p_status,admin_note=nullif(trim(p_admin_note),''),reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_report_id returning * into v_row;
  if not found then raise exception 'Сигналът не е намерен.'; end if;
  return jsonb_build_object('id',v_row.id,'status',v_row.status,'admin_note',v_row.admin_note,
    'reviewed_at',v_row.reviewed_at,'reviewed_by',v_row.reviewed_by);
end;
$$;

revoke all on function public.sexsi_admin_list_moderator_reports() from public,anon;
revoke all on function public.sexsi_admin_update_moderator_report(uuid,text,text) from public,anon;
grant execute on function public.sexsi_admin_list_moderator_reports() to authenticated;
grant execute on function public.sexsi_admin_update_moderator_report(uuid,text,text) to authenticated;
