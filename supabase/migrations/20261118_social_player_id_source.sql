CREATE OR REPLACE FUNCTION public.sexsi_chat_users()
RETURNS TABLE(user_id uuid, username text, player_id text, is_admin boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(p.player_id), ''), u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id <> auth.uid()
  ORDER BY lower(coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

CREATE OR REPLACE FUNCTION public.sexsi_chat_list()
RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_username text, other_player_id text,
  other_is_admin boolean, last_message text, last_message_at timestamptz, unread_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT c.id, other_user.id,
    coalesce(nullif(trim(other_user.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(p.player_id), ''),
    other_user.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid,
    latest.body, coalesce(latest.created_at, c.created_at),
    (SELECT count(*) FROM public.sexsi_messages unread
      WHERE unread.conversation_id = c.id AND unread.recipient_id = auth.uid() AND unread.read_at IS NULL)
  FROM public.sexsi_conversations c
  JOIN auth.users other_user ON other_user.id =
    CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END
  LEFT JOIN public.profiles p ON p.id = other_user.id
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at FROM public.sexsi_messages m
    WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
  ) latest ON true
  WHERE auth.uid() = c.user_a OR auth.uid() = c.user_b
  ORDER BY coalesce(latest.created_at, c.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_directory()
RETURNS TABLE(user_id uuid, username text, player_id text, is_admin boolean, relation_status text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(p.player_id), ''), u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friends f
        WHERE f.user_a = least(auth.uid(),u.id) AND f.user_b = greatest(auth.uid(),u.id)) THEN 'friend'
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friend_requests r
        WHERE r.status='pending' AND r.sender_id=auth.uid() AND r.receiver_id=u.id) THEN 'sent'
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friend_requests r
        WHERE r.status='pending' AND r.sender_id=u.id AND r.receiver_id=auth.uid()) THEN 'received'
      ELSE 'none'
    END
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE auth.uid() IS NOT NULL AND u.id <> auth.uid()
  ORDER BY lower(coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_list()
RETURNS TABLE(user_id uuid, username text, player_id text, is_admin boolean, since_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(p.player_id), ''), u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid, f.created_at
  FROM public.sexsi_friends f
  JOIN auth.users u ON u.id = CASE WHEN f.user_a=auth.uid() THEN f.user_b ELSE f.user_a END
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE auth.uid() = f.user_a OR auth.uid() = f.user_b
  ORDER BY lower(coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_requests_list()
RETURNS TABLE(request_id uuid, other_user_id uuid, other_username text, other_player_id text,
  other_is_admin boolean, direction text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE
AS $$
  SELECT r.id, u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    nullif(trim(p.player_id), ''), u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid,
    CASE WHEN r.receiver_id=auth.uid() THEN 'incoming' ELSE 'outgoing' END, r.created_at
  FROM public.sexsi_friend_requests r
  JOIN auth.users u ON u.id = CASE WHEN r.receiver_id=auth.uid() THEN r.sender_id ELSE r.receiver_id END
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE r.status='pending' AND (r.sender_id=auth.uid() OR r.receiver_id=auth.uid())
  ORDER BY r.created_at DESC;
$$;

NOTIFY pgrst, 'reload schema';
