-- Donario v3: permitir ver profiles de miembros del mismo centro.
-- Antes: policy "users_own_profile" USING (id = auth.uid()) ocultaba
-- los profiles de otros miembros, así que en /centro/miembros se veían
-- los user_ids pero sin nombre/email (profile: null).
-- Ahora: miembros activos de cualquier centro pueden leer profiles de
-- usuarios que también son miembros activos (del mismo centro).

DROP POLICY IF EXISTS "members_can_read_profiles_same_center" ON profiles;

CREATE POLICY "members_can_read_profiles_same_center" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM center_members my_cm
      JOIN center_members their_cm ON their_cm.center_id = my_cm.center_id
      WHERE my_cm.user_id = auth.uid()
        AND my_cm.is_active = true
        AND their_cm.user_id = profiles.id
        AND their_cm.is_active = true
    )
  );
