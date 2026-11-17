-- SEXSI TOURNAMENTS: лични съобщения между всички регистрирани потребители
-- Изпълни целия файл в Supabase SQL Editor.

create table if not exists public.sexsi_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint sexsi_conversations_distinct_users check (user_a < user_b),
  constraint sexsi_conversations_unique_pair unique (user_a, user_b)
);

create table if not exists public.sexsi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sexsi_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint sexsi_messages_distinct_users check (sender_id <> recipient_id)
);

create index if not exists sexsi_messages_conversation_created_idx
  on public.sexsi_messages (conversation_id, created_at desc);

create index if not exists sexsi_messages_recipient_unread_idx
  on public.sexsi_messages (recipient_id, read_at)
  where read_at is null;

alter table public.sexsi_conversations enable row level security;
alter table public.sexsi_messages enable row level security;

drop policy if exists "Users can read their own conversations" on public.sexsi_conversations;
create policy "Users can read their own conversations"
on public.sexsi_conversations
for select
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Participants can read their messages" on public.sexsi_messages;
create policy "Participants can read their messages"
on public.sexsi_messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages in their conversations" on public.sexsi_messages;
create policy "Users can send messages in their conversations"
on public.sexsi_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.sexsi_conversations c
    where c.id = conversation_id
      and (
        (c.user_a = auth.uid() and c.user_b = recipient_id)
        or
        (c.user_b = auth.uid() and c.user_a = recipient_id)
      )
  )
);

drop policy if exists "Recipients can mark messages as read" on public.sexsi_messages;
create policy "Recipients can mark messages as read"
on public.sexsi_messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

grant select on public.sexsi_conversations to authenticated;
grant select on public.sexsi_messages to authenticated;
grant insert on public.sexsi_messages to authenticated;
grant update (read_at) on public.sexsi_messages to authenticated;

create or replace function public.sexsi_chat_users()
returns table (
  user_id uuid,
  username text,
  player_id text,
  is_admin boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(u.raw_user_meta_data ->> 'player_id'), ''),
    u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  from auth.users u
  where u.id <> auth.uid()
  order by lower(coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

create or replace function public.sexsi_chat_start(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_conversation_id uuid;
begin
  if v_user is null then
    raise exception 'Трябва да влезеш в профила си.';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user then
    raise exception 'Невалиден получател.';
  end if;

  if not exists (select 1 from auth.users where id = p_other_user_id) then
    raise exception 'Потребителят не е намерен.';
  end if;

  v_a := least(v_user, p_other_user_id);
  v_b := greatest(v_user, p_other_user_id);

  insert into public.sexsi_conversations (user_a, user_b)
  values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select id into v_conversation_id
  from public.sexsi_conversations
  where user_a = v_a and user_b = v_b;

  return v_conversation_id;
end;
$$;

create or replace function public.sexsi_chat_list()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_username text,
  other_player_id text,
  other_is_admin boolean,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.id,
    other_user.id,
    coalesce(nullif(trim(other_user.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(other_user.raw_user_meta_data ->> 'player_id'), ''),
    other_user.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid,
    latest.body,
    coalesce(latest.created_at, c.created_at),
    (
      select count(*)
      from public.sexsi_messages unread
      where unread.conversation_id = c.id
        and unread.recipient_id = auth.uid()
        and unread.read_at is null
    )
  from public.sexsi_conversations c
  join auth.users other_user
    on other_user.id = case
      when c.user_a = auth.uid() then c.user_b
      else c.user_a
    end
  left join lateral (
    select m.body, m.created_at
    from public.sexsi_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) latest on true
  where auth.uid() = c.user_a or auth.uid() = c.user_b
  order by coalesce(latest.created_at, c.created_at) desc;
$$;

create or replace function public.sexsi_chat_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sexsi_conversations c
    where c.id = p_conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ) then
    raise exception 'Нямаш достъп до този разговор.';
  end if;

  update public.sexsi_messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and recipient_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.sexsi_chat_users() from public;
revoke all on function public.sexsi_chat_start(uuid) from public;
revoke all on function public.sexsi_chat_list() from public;
revoke all on function public.sexsi_chat_mark_read(uuid) from public;

grant execute on function public.sexsi_chat_users() to authenticated;
grant execute on function public.sexsi_chat_start(uuid) to authenticated;
grant execute on function public.sexsi_chat_list() to authenticated;
grant execute on function public.sexsi_chat_mark_read(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'sexsi_messages'
    ) then
      alter publication supabase_realtime add table public.sexsi_messages;
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';
