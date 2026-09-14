import { supabase } from './supabase';

export type ModuleId =
  | 'inicio'
  | 'productos'
  | 'medicamentos'
  | 'formulas'
  | 'kits'
  | 'entradas'
  | 'salidas'
  | 'movimientos'
  | 'bodegas'
  | 'traslados'
  | 'donantes'
  | 'beneficiarios'
  | 'voluntarios'
  | 'comedor'
  | 'informes'
  | 'centro'
  | 'configuracion';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface UserModulePermission {
  module_id: ModuleId;
  module_name: string;
  category?: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  category: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { id: 'inicio', name: 'Inicio / Dashboard', category: 'General' },
  { id: 'productos', name: 'Productos', category: 'Inventario' },
  { id: 'medicamentos', name: 'Medicamentos e insumos', category: 'Inventario' },
  { id: 'formulas', name: 'Fórmulas médicas', category: 'Inventario' },
  { id: 'kits', name: 'Kits de donaciones', category: 'Inventario' },
  { id: 'entradas', name: 'Entradas de inventario', category: 'Operaciones' },
  { id: 'salidas', name: 'Salidas de inventario', category: 'Operaciones' },
  { id: 'movimientos', name: 'Historial de movimientos', category: 'Operaciones' },
  { id: 'bodegas', name: 'Bodegas', category: 'Almacén' },
  { id: 'traslados', name: 'Traslados entre bodegas', category: 'Almacén' },
  { id: 'donantes', name: 'Donantes', category: 'Personas' },
  { id: 'beneficiarios', name: 'Beneficiarios', category: 'Personas' },
  { id: 'voluntarios', name: 'Voluntarios', category: 'Personas' },
  { id: 'comedor', name: 'Comedor comunitario', category: 'Personas' },
  { id: 'informes', name: 'Informes y reportes', category: 'Reportes' },
  { id: 'centro', name: 'Centro de acopio y miembros', category: 'Administración' },
  { id: 'configuracion', name: 'Configuración del sistema', category: 'Administración' },
];

export type PermissionMap = Record<
  string,
  { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }
>;

/**
 * Obtiene los permisos mapeados por módulo para el usuario actual.
 */
export async function fetchCurrentPermissions(
  userId: string,
  isSuperAdmin: boolean,
): Promise<PermissionMap> {
  const map: PermissionMap = {};

  if (isSuperAdmin) {
    for (const m of MODULE_DEFINITIONS) {
      map[m.id] = { can_view: true, can_create: true, can_edit: true, can_delete: true };
    }
    return map;
  }

  try {
    const { data, error } = await supabase
      .from('user_module_permissions')
      .select('module_id, can_view, can_create, can_edit, can_delete')
      .eq('user_id', userId);

    if (error || !data || data.length === 0) {
      // Fallback por defecto si no existen filas de permisos asignadas aún
      for (const m of MODULE_DEFINITIONS) {
        map[m.id] = { can_view: true, can_create: false, can_edit: false, can_delete: false };
      }
      return map;
    }

    for (const row of data) {
      map[row.module_id] = {
        can_view: row.can_view,
        can_create: row.can_create,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
      };
    }
  } catch (err) {
    console.warn('Error fetching permissions from user_module_permissions, using fallback', err);
    for (const m of MODULE_DEFINITIONS) {
      map[m.id] = { can_view: true, can_create: false, can_edit: false, can_delete: false };
    }
  }

  return map;
}

/**
 * Consulta los permisos de un miembro.
 * Intenta usar RPC; si no existe en Supabase, consulta la tabla user_module_permissions directamente.
 */
export async function fetchMemberPermissions(
  targetUserId: string,
): Promise<UserModulePermission[]> {
  // Intentar RPC primero
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_member_permissions', {
    p_target_user_id: targetUserId,
  });

  if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
    return rpcData.map((d: any) => ({
      module_id: d.module_id,
      module_name: d.module_name || MODULE_DEFINITIONS.find((m) => m.id === d.module_id)?.name || d.module_id,
      category: MODULE_DEFINITIONS.find((m) => m.id === d.module_id)?.category || 'Otros',
      can_view: d.can_view ?? false,
      can_create: d.can_create ?? false,
      can_edit: d.can_edit ?? false,
      can_delete: d.can_delete ?? false,
    }));
  }

  // Fallback directo si la RPC no existe aún en el esquema de Supabase
  const { data: tableData } = await supabase
    .from('user_module_permissions')
    .select('module_id, can_view, can_create, can_edit, can_delete')
    .eq('user_id', targetUserId);

  const permByModule = new Map<string, any>(
    (tableData ?? []).map((row) => [row.module_id, row]),
  );

  return MODULE_DEFINITIONS.map((def) => {
    const existing = permByModule.get(def.id);
    return {
      module_id: def.id,
      module_name: def.name,
      category: def.category,
      can_view: existing?.can_view ?? true,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
    };
  });
}

/**
 * Guarda los permisos de un miembro.
 * Intenta usar RPC; si falla por no existir la función, guarda con upsert directo.
 */
export async function saveMemberPermissions(
  targetUserId: string,
  permissions: Array<{
    module_id: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>,
  centerId?: string | null,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc('save_member_permissions', {
    p_target_user_id: targetUserId,
    p_permissions: permissions,
  });

  if (!rpcError) return;

  // Fallback: upsert directo a la tabla
  let targetCenterId = centerId;
  if (!targetCenterId) {
    const { data: member } = await supabase
      .from('center_members')
      .select('center_id')
      .eq('user_id', targetUserId)
      .limit(1)
      .maybeSingle();
    targetCenterId = member?.center_id ?? null;
  }

  if (!targetCenterId) {
    throw new Error('No se pudo identificar el centro del usuario para guardar permisos');
  }

  const upsertRows = permissions.map((p) => ({
    center_id: targetCenterId,
    user_id: targetUserId,
    module_id: p.module_id,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await supabase
    .from('user_module_permissions')
    .upsert(upsertRows, { onConflict: 'center_id,user_id,module_id' });

  if (upsertErr) {
    console.error('Fallback upsert permissions failed:', upsertErr);
    throw new Error(`Error al guardar permisos: ${upsertErr.message}`);
  }
}
