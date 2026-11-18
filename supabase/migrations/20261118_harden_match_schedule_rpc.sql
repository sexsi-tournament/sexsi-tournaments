CREATE OR REPLACE FUNCTION public.sexsi_admin_set_match_schedule(
  p_match_id uuid,
  p_scheduled_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM '13f1ada8-cd05-4c31-8940-4fb1790cb90e'::uuid THEN
    RAISE EXCEPTION 'Нямаш права за тази операция.';
  END IF;
  IF p_scheduled_at IS NULL THEN RAISE EXCEPTION 'Избери дата и час за двубоя.'; END IF;
  UPDATE public.matches SET scheduled_at = p_scheduled_at WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Двубоят не беше намерен.'; END IF;
  RETURN 'Датата и часът за двубоя са запазени успешно.';
END;
$function$;

REVOKE ALL ON FUNCTION public.sexsi_admin_set_match_schedule(uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sexsi_admin_set_match_schedule(uuid,timestamptz) TO authenticated;
