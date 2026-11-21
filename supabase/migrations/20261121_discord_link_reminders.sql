create table if not exists public.discord_link_reminders (
  discord_user_id text primary key check (discord_user_id ~ '^[0-9]{15,22}$'),
  discord_username text not null,
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  last_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  discord_message_id text,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.discord_link_reminders enable row level security;
revoke all on public.discord_link_reminders from anon, authenticated;
grant all on public.discord_link_reminders to service_role;

create or replace function public.sexsi_reserve_discord_link_reminder(
  p_discord_user_id text,
  p_discord_username text,
  p_actor uuid
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  reserved_id text;
begin
  insert into public.discord_link_reminders (
    discord_user_id, discord_username, status, last_attempt_at, sent_at,
    discord_message_id, last_error, created_by, updated_at
  ) values (
    p_discord_user_id, p_discord_username, 'sending', now(), null,
    null, null, p_actor, now()
  )
  on conflict (discord_user_id) do update
    set discord_username = excluded.discord_username,
        status = 'sending',
        last_attempt_at = now(),
        discord_message_id = null,
        last_error = null,
        created_by = excluded.created_by,
        updated_at = now()
    where public.discord_link_reminders.status <> 'sending'
      and (
        public.discord_link_reminders.sent_at is null
        or public.discord_link_reminders.sent_at < now() - interval '24 hours'
      )
      and (
        public.discord_link_reminders.status <> 'failed'
        or public.discord_link_reminders.last_attempt_at < now() - interval '60 seconds'
      )
  returning discord_user_id into reserved_id;

  return reserved_id is not null;
end;
$$;

revoke all on function public.sexsi_reserve_discord_link_reminder(text,text,uuid) from public, anon, authenticated;
grant execute on function public.sexsi_reserve_discord_link_reminder(text,text,uuid) to service_role;
