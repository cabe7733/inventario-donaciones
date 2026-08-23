-- Donario v2: Auth + Multi-Tenant
-- Fase 1: Perfiles, centros, membresías e invitaciones

-- ================= PERFILES =================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  doc_type TEXT,              -- 'cedula', 'pasaporte', 'dni'
  doc_number TEXT,            -- número de documento
  birth_date DATE,           -- fecha de nacimiento
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================= CENTROS DE ACOPIO =================

CREATE TABLE IF NOT EXISTS centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  -- Datos representante legal
  entity_type TEXT CHECK (entity_type IN ('person', 'entity')),
  entity_name TEXT,              -- razón social o nombre completo
  entity_rfc TEXT,               -- cédula, NIT, RFC
  representative_name TEXT,
  representative_id TEXT,
  representative_phone TEXT,
  representative_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ================= MEMBRESÍA EN CENTROS =================

CREATE TABLE IF NOT EXISTS center_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'visualizer')),
  invited_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (center_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_center_members_user ON center_members (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_center_members_center ON center_members (center_id) WHERE is_active = true;

-- ================= INVITACIONES PENDIENTES =================

CREATE TABLE IF NOT EXISTS center_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'visualizer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (center_id, email)
);

-- ================= FUNCIONES HELPER PARA RLS =================

CREATE OR REPLACE FUNCTION public.get_user_center_id()
RETURNS UUID AS $$
  SELECT center_id FROM public.center_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.center_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.center_members
    WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ================= RPC: CREAR CENTRO =================

CREATE OR REPLACE FUNCTION public.create_center(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT '',
  p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_state TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_email TEXT DEFAULT '',
  p_entity_type TEXT DEFAULT 'person',
  p_entity_name TEXT DEFAULT '',
  p_entity_rfc TEXT DEFAULT '',
  p_representative_name TEXT DEFAULT '',
  p_representative_id TEXT DEFAULT '',
  p_representative_phone TEXT DEFAULT '',
  p_representative_email TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  new_center_id UUID;
BEGIN
  INSERT INTO centers (
    name, slug, description, address, city, state, phone, email,
    entity_type, entity_name, entity_rfc,
    representative_name, representative_id, representative_phone,
    representative_email, created_by
  ) VALUES (
    p_name, p_slug, p_description, p_address, p_city, p_state, p_phone, p_email,
    p_entity_type, p_entity_name, p_entity_rfc,
    p_representative_name, p_representative_id, p_representative_phone,
    p_representative_email, auth.uid()
  ) RETURNING id INTO new_center_id;

  INSERT INTO center_members (center_id, user_id, role, invited_by)
  VALUES (new_center_id, auth.uid(), 'super_admin', auth.uid());

  RETURN new_center_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= RPC: INVITAR MIEMBRO =================

CREATE OR REPLACE FUNCTION public.invite_to_center(
  p_email TEXT,
  p_role TEXT
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede invitar miembros';
  END IF;

  INSERT INTO center_invitations (center_id, email, role, invited_by)
  VALUES (public.get_user_center_id(), p_email, p_role, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= RPC: ACEPTAR INVITACIÓN =================

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_invitation_id UUID
)
RETURNS UUID AS $$
DECLARE
  invitation_record RECORD;
  new_member_id UUID;
BEGIN
  SELECT * INTO invitation_record
  FROM center_invitations
  WHERE id = p_invitation_id
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now();

  IF invitation_record IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada o expirada';
  END IF;

  INSERT INTO center_members (center_id, user_id, role, invited_by)
  VALUES (invitation_record.center_id, auth.uid(), invitation_record.role, invitation_record.invited_by)
  ON CONFLICT (center_id, user_id) DO UPDATE SET role = invitation_record.role, is_active = true
  RETURNING id INTO new_member_id;

  UPDATE center_invitations SET accepted_at = now() WHERE id = p_invitation_id;

  RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
