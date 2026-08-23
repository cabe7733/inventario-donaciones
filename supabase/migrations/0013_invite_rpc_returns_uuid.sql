-- Update invite_to_center to return the new invitation UUID so the frontend can show/copy the code.
-- Also add an RLS policy so authenticated users can read invitations addressed to their email
-- (so a new user can verify they have a pending invitation before attempting to accept it).

-- ponytail: must DROP first because return type changes from VOID to UUID
DROP FUNCTION IF EXISTS public.invite_to_center(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invite_to_center(
  p_email TEXT,
  p_role TEXT
)
RETURNS UUID AS $$
DECLARE
  new_invitation_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede invitar miembros';
  END IF;

  INSERT INTO center_invitations (center_id, email, role, invited_by)
  VALUES (public.get_user_center_id(), p_email, p_role, auth.uid())
  RETURNING id INTO new_invitation_id;

  RETURN new_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ponytail: let invited users see invitations addressed to their email
DROP POLICY IF EXISTS "users_can_read_own_invitations" ON center_invitations;
CREATE POLICY "users_can_read_own_invitations" ON center_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
