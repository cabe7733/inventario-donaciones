-- Donario v3: RPC para devolver profiles de miembros del centro del usuario.
-- SECURITY DEFINER bypasea RLS de profiles (que solo deja leer el propio).
-- Devuelve solo los profiles de usuarios que son miembros activos del
-- mismo centro que el caller.

CREATE OR REPLACE FUNCTION get_center_member_profiles()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  first_name text,
  last_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_center uuid;
BEGIN
  v_center := public.get_user_center_id();
  IF v_center IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cm.user_id, p.full_name, p.first_name, p.last_name, p.email
    FROM center_members cm
    LEFT JOIN profiles p ON p.id = cm.user_id
    WHERE cm.center_id = v_center AND cm.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION get_center_member_profiles() TO authenticated;
