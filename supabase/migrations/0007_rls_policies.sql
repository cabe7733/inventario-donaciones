-- Donario v2: RLS Policies multi-tenant
-- Fase 2: Reemplazar anon full access por policies basadas en auth

-- ================= ELIMINAR POLÍTICAS ANON EXISTENTES =================

DROP POLICY IF EXISTS "anon full access" ON categories;
DROP POLICY IF EXISTS "anon full access" ON units;
DROP POLICY IF EXISTS "anon full access" ON products;
DROP POLICY IF EXISTS "anon full access" ON medications;
DROP POLICY IF EXISTS "anon full access" ON medication_lots;
DROP POLICY IF EXISTS "anon full access" ON movements;
DROP POLICY IF EXISTS "anon full access" ON operadores;
DROP POLICY IF EXISTS "anon full access" ON kits;
DROP POLICY IF EXISTS "anon full access" ON kit_components;
DROP POLICY IF EXISTS "anon full access" ON kit_builds;
DROP POLICY IF EXISTS "anon full access" ON kit_deliveries;
DROP POLICY IF EXISTS "anon full access" ON sync_log;

-- ================= POLÍTICAS PARA PROFILES =================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (id = auth.uid());

-- ================= POLÍTICAS PARA CENTERS =================

ALTER TABLE centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_own_center" ON centers
  FOR SELECT USING (id = public.get_user_center_id());

CREATE POLICY "super_admin_full_access_centers" ON centers
  FOR ALL USING (public.is_super_admin());

-- ================= POLÍTICAS PARA CENTER_MEMBERS =================

ALTER TABLE center_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_own_center_members" ON center_members
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "super_admin_manage_members" ON center_members
  FOR ALL USING (public.is_super_admin());

-- ================= POLÍTICAS PARA CENTER_INVITATIONS =================

ALTER TABLE center_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_invitations" ON center_invitations
  FOR ALL USING (public.is_super_admin());

-- ================= POLÍTICAS PARA CATEGORIES =================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_categories" ON categories
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_categories" ON categories
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_categories" ON categories
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_categories" ON categories
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA UNITS =================

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_units" ON units
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_units" ON units
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_units" ON units
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_units" ON units
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA PRODUCTS =================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_products" ON products
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_products" ON products
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_products" ON products
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_products" ON products
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA MEDICATIONS =================

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_medications" ON medications
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_medications" ON medications
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_medications" ON medications
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_medications" ON medications
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA MEDICATION_LOTS =================

ALTER TABLE medication_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_medication_lots" ON medication_lots
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_medication_lots" ON medication_lots
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_medication_lots" ON medication_lots
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_medication_lots" ON medication_lots
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA MOVEMENTS =================

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_movements" ON movements
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_movements" ON movements
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= POLÍTICAS PARA OPERADORES =================

ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_operadores" ON operadores
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_operadores" ON operadores
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_operadores" ON operadores
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_operadores" ON operadores
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA KITS =================

ALTER TABLE kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_kits" ON kits
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_kits" ON kits
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_kits" ON kits
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_kits" ON kits
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= POLÍTICAS PARA KIT_COMPONENTS =================

ALTER TABLE kit_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_kit_components" ON kit_components
  FOR SELECT USING (
    kit_id IN (SELECT id FROM kits WHERE center_id = public.get_user_center_id())
  );

CREATE POLICY "center_admins_can_insert_kit_components" ON kit_components
  FOR INSERT WITH CHECK (
    kit_id IN (SELECT id FROM kits WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_kit_components" ON kit_components
  FOR UPDATE USING (
    kit_id IN (SELECT id FROM kits WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_delete_kit_components" ON kit_components
  FOR DELETE USING (
    kit_id IN (SELECT id FROM kits WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= POLÍTICAS PARA KIT_BUILDS =================

ALTER TABLE kit_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_kit_builds" ON kit_builds
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_kit_builds" ON kit_builds
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= POLÍTICAS PARA KIT_DELIVERIES =================

ALTER TABLE kit_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_kit_deliveries" ON kit_deliveries
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_kit_deliveries" ON kit_deliveries
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= POLÍTICAS PARA SYNC_LOG =================

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- sync_log es global (no center-scoped) — solo super_admin puede leer
CREATE POLICY "super_admin_can_read_sync_log" ON sync_log
  FOR SELECT USING (public.is_super_admin());
