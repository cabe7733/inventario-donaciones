-- Donario v3 (fix): get_center_member_profiles usaba p.email (profiles),
-- pero profiles no tiene columna email — vive en auth.users.

DROP FUNCTION IF EXISTS get_center_member_profiles();

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
    SELECT cm.user_id, p.full_name, p.first_name, p.last_name, u.email
    FROM center_members cm
    LEFT JOIN profiles p ON p.id = cm.user_id
    LEFT JOIN auth.users u ON u.id = cm.user_id
    WHERE cm.center_id = v_center AND cm.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION get_center_member_profiles() TO authenticated;
