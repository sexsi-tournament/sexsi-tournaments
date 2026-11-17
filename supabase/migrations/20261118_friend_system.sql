-- SEXSI TOURNAMENTS: система за приятелства
-- Без изтриване на съществуващи разговори или съобщения.

CREATE TABLE IF NOT EXISTS public.sexsi_friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT sexsi_friend_requests_distinct CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sexsi_friend_requests_one_pending_pair
ON public.sexsi_friend_requests (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id)
)
WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.sexsi_friends (
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sexsi_friends_distinct CHECK (user_a < user_b),
  CONSTRAINT sexsi_friends_unique UNIQUE (user_a, user_b)
);

ALTER TABLE public.sexsi_friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sexsi_friends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sexsi_friend_requests FROM anon, authenticated;
REVOKE ALL ON public.sexsi_friends FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sexsi_friend_directory()
RETURNS TABLE(user_id UUID, username TEXT, player_id TEXT, is_admin BOOLEAN, relation_status TEXT)
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'player_id'), ''),
    u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::UUID,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friends f
        WHERE f.user_a = LEAST(auth.uid(),u.id) AND f.user_b = GREATEST(auth.uid(),u.id))
        THEN 'friend'
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friend_requests r
        WHERE r.status='pending' AND r.sender_id=auth.uid() AND r.receiver_id=u.id)
        THEN 'sent'
      WHEN EXISTS (SELECT 1 FROM public.sexsi_friend_requests r
        WHERE r.status='pending' AND r.sender_id=u.id AND r.receiver_id=auth.uid())
        THEN 'received'
      ELSE 'none'
    END
  FROM auth.users u
  WHERE auth.uid() IS NOT NULL AND u.id <> auth.uid()
  ORDER BY lower(COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_list()
RETURNS TABLE(user_id UUID, username TEXT, player_id TEXT, is_admin BOOLEAN, since_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'player_id'), ''),
    u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::UUID,
    f.created_at
  FROM public.sexsi_friends f
  JOIN auth.users u ON u.id = CASE WHEN f.user_a=auth.uid() THEN f.user_b ELSE f.user_a END
  WHERE auth.uid() = f.user_a OR auth.uid() = f.user_b
  ORDER BY lower(COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'username'), ''), 'Играч'));
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_requests_list()
RETURNS TABLE(request_id UUID, other_user_id UUID, other_username TEXT, other_player_id TEXT, other_is_admin BOOLEAN, direction TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT r.id, u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'username'), ''), 'Играч'),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'player_id'), ''),
    u.id = '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::UUID,
    CASE WHEN r.receiver_id=auth.uid() THEN 'incoming' ELSE 'outgoing' END,
    r.created_at
  FROM public.sexsi_friend_requests r
  JOIN auth.users u ON u.id = CASE WHEN r.receiver_id=auth.uid() THEN r.sender_id ELSE r.receiver_id END
  WHERE r.status='pending' AND (r.sender_id=auth.uid() OR r.receiver_id=auth.uid())
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_request_send(p_user_id UUID)
RETURNS TEXT LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Трябва да влезеш в профила си.'; END IF;
  IF p_user_id IS NULL OR p_user_id=auth.uid() THEN RAISE EXCEPTION 'Невалиден потребител.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Потребителят не е намерен.'; END IF;
  IF EXISTS (SELECT 1 FROM public.sexsi_friends f WHERE f.user_a=LEAST(auth.uid(),p_user_id) AND f.user_b=GREATEST(auth.uid(),p_user_id)) THEN
    RETURN 'already_friends';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sexsi_friend_requests r WHERE r.status='pending' AND r.sender_id=p_user_id AND r.receiver_id=auth.uid()) THEN
    RETURN 'incoming_exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sexsi_friend_requests r WHERE r.status='pending' AND r.sender_id=auth.uid() AND r.receiver_id=p_user_id) THEN
    RETURN 'already_sent';
  END IF;
  INSERT INTO public.sexsi_friend_requests(sender_id,receiver_id,status) VALUES(auth.uid(),p_user_id,'pending');
  RETURN 'sent';
END;
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_request_respond(p_request_id UUID,p_accept BOOLEAN)
RETURNS TEXT LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_request public.sexsi_friend_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.sexsi_friend_requests
  WHERE id=p_request_id AND receiver_id=auth.uid() AND status='pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Поканата не е намерена или вече е обработена.'; END IF;
  IF p_accept THEN
    INSERT INTO public.sexsi_friends(user_a,user_b)
    VALUES(LEAST(v_request.sender_id,v_request.receiver_id),GREATEST(v_request.sender_id,v_request.receiver_id))
    ON CONFLICT DO NOTHING;
    UPDATE public.sexsi_friend_requests SET status='accepted',responded_at=now() WHERE id=p_request_id;
    RETURN 'accepted';
  ELSE
    UPDATE public.sexsi_friend_requests SET status='rejected',responded_at=now() WHERE id=p_request_id;
    RETURN 'rejected';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sexsi_friend_remove(p_user_id UUID)
RETURNS VOID LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.sexsi_friends
  WHERE user_a=LEAST(auth.uid(),p_user_id) AND user_b=GREATEST(auth.uid(),p_user_id);
  UPDATE public.sexsi_friend_requests
  SET status='cancelled',responded_at=now()
  WHERE status='pending' AND (
    (sender_id=auth.uid() AND receiver_id=p_user_id) OR
    (sender_id=p_user_id AND receiver_id=auth.uid())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sexsi_friend_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_friend_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_friend_requests_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_friend_request_send(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_friend_request_respond(UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sexsi_friend_remove(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sexsi_friend_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_friend_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_friend_requests_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_friend_request_send(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_friend_request_respond(UUID,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sexsi_friend_remove(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
