-- Migration 0043: Permisos granulares por módulo

-- 1. Tabla de catálogo de módulos basada en el menú del sistema
CREATE TABLE IF NOT EXISTS public.modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.modules (id, name, description) VALUES
  ('inicio', 'Inicio / Dashboard', 'Vista principal y métricas generales'),
  ('productos', 'Productos', 'Gestión de catálogo de productos e inventario general'),
  ('medicamentos', 'Medicamentos e insumos', 'Gestión de medicamentos, insumos médicos y lotes'),
  ('formulas', 'Fórmulas médicas', 'Gestión y despacho de fórmulas médicas'),
  ('kits', 'Kits de donaciones', 'Armado, edición y entrega de kits de donaciones'),
  ('entradas', 'Entradas de inventario', 'Registro y gestión de órdenes de entrada'),
  ('salidas', 'Salidas de inventario', 'Registro y gestión de órdenes de salida'),
  ('movimientos', 'Historial de movimientos', 'Consulta de trazabilidad y movimientos de inventario'),
  ('bodegas', 'Bodegas', 'Gestión de bodegas del centro'),
  ('traslados', 'Traslados entre bodegas', 'Transferencia de inventario entre bodegas'),
  ('donantes', 'Donantes', 'Directorio y registro de donantes'),
  ('beneficiarios', 'Beneficiarios', 'Directorio y registro de beneficiarios'),
  ('voluntarios', 'Voluntarios', 'Registro y gestión de voluntarios'),
  ('comedor', 'Comedor comunitario', 'Gestión de personas y registro de visitas al comedor'),
  ('informes', 'Informes y reportes', 'Acceso a informes analíticos y estadísticas'),
  ('centro', 'Centro de acopio y miembros', 'Configuración del centro y gestión de miembros'),
  ('configuracion', 'Configuración del sistema', 'Gestión de categorías, unidades y autorizadores')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 2. Tabla de permisos por usuario y módulo
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (center_id, user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_module_permissions_lookup 
  ON public.user_module_permissions (center_id, user_id, module_id);

-- 3. Función SQL helper para verificar permisos
CREATE OR REPLACE FUNCTION public.has_module_permission(
  p_module_id TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_center_id UUID;
  v_allowed BOOLEAN := false;
BEGIN
  -- Super admin tiene acceso total a todos los módulos y acciones
  v_role := public.get_user_role();
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  v_center_id := public.get_user_center_id();
  IF v_center_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT 
    CASE 
      WHEN p_action = 'view' THEN can_view
      WHEN p_action = 'create' THEN can_create
      WHEN p_action = 'edit' THEN can_edit
      WHEN p_action = 'delete' THEN can_delete
      ELSE false
    END INTO v_allowed
  FROM public.user_module_permissions
  WHERE center_id = v_center_id 
    AND user_id = auth.uid() 
    AND module_id = p_module_id;

  RETURN COALESCE(v_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Función de Backfill para migrar miembros existentes sin perder acceso
CREATE OR REPLACE FUNCTION public.backfill_user_permissions()
RETURNS VOID AS $$
DECLARE
  m RECORD;
  mod RECORD;
BEGIN
  FOR m IN SELECT center_id, user_id, role FROM public.center_members WHERE is_active = true LOOP
    FOR mod IN SELECT id FROM public.modules LOOP
      INSERT INTO public.user_module_permissions (
        center_id, user_id, module_id, can_view, can_create, can_edit, can_delete
      ) VALUES (
        m.center_id,
        m.user_id,
        mod.id,
        true, -- todos pueden ver
        CASE WHEN m.role IN ('super_admin', 'admin') THEN true ELSE false END,
        CASE WHEN m.role IN ('super_admin', 'admin') THEN true ELSE false END,
        CASE WHEN m.role = 'super_admin' THEN true ELSE false END
      )
      ON CONFLICT (center_id, user_id, module_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar el backfill
SELECT public.backfill_user_permissions();

-- 5. RPC para consultar permisos de un miembro específico (para la UI de administración)
CREATE OR REPLACE FUNCTION public.get_member_permissions(
  p_target_user_id UUID
)
RETURNS TABLE (
  module_id TEXT,
  module_name TEXT,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
DECLARE
  v_center_id UUID := public.get_user_center_id();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede consultar permisos de miembros';
  END IF;

  RETURN QUERY
  SELECT 
    m.id AS module_id,
    m.name AS module_name,
    COALESCE(p.can_view, false) AS can_view,
    COALESCE(p.can_create, false) AS can_create,
    COALESCE(p.can_edit, false) AS can_edit,
    COALESCE(p.can_delete, false) AS can_delete
  FROM public.modules m
  LEFT JOIN public.user_module_permissions p 
    ON p.module_id = m.id AND p.center_id = v_center_id AND p.user_id = p_target_user_id
  ORDER BY m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC para guardar permisos de un miembro
CREATE OR REPLACE FUNCTION public.save_member_permissions(
  p_target_user_id UUID,
  p_permissions JSONB
)
RETURNS VOID AS $$
DECLARE
  v_center_id UUID := public.get_user_center_id();
  v_target_role TEXT;
  elem JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo super_admin puede modificar permisos de miembros';
  END IF;

  SELECT role INTO v_target_role FROM public.center_members 
  WHERE center_id = v_center_id AND user_id = p_target_user_id AND is_active = true;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'No se pueden restringir permisos al super_admin';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_permissions) LOOP
    INSERT INTO public.user_module_permissions (
      center_id, user_id, module_id, can_view, can_create, can_edit, can_delete
    ) VALUES (
      v_center_id,
      p_target_user_id,
      elem->>'module_id',
      COALESCE((elem->>'can_view')::boolean, false),
      COALESCE((elem->>'can_create')::boolean, false),
      COALESCE((elem->>'can_edit')::boolean, false),
      COALESCE((elem->>'can_delete')::boolean, false)
    )
    ON CONFLICT (center_id, user_id, module_id) DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_create = EXCLUDED.can_create,
      can_edit = EXCLUDED.can_edit,
      can_delete = EXCLUDED.can_delete,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.has_module_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_member_permissions(UUID, JSONB) TO authenticated;
