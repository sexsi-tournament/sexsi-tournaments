-- Restrict message updates to the read receipt column only.
-- Prevents recipients from editing message bodies or changing message metadata.
REVOKE UPDATE ON TABLE public.sexsi_messages FROM authenticated;
GRANT UPDATE (read_at) ON TABLE public.sexsi_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
