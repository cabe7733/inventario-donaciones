import { supabase } from './supabase';
import { newId, nowISO } from './ids';
import type { NeedPriority, NeedItemType } from './centerOps';

// ---------- Types ----------

export interface CenterNeed {
  id: string;
  center_id: string;
  item_type: NeedItemType;
  item_id: string | null;
  title: string;
  description: string;
  quantity_needed: number;
  quantity_received: number;
  priority: NeedPriority;
  status: 'active' | 'fulfilled' | 'cancelled';
  source: 'inventory' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface CenterNeedInput {
  item_type: NeedItemType;
  item_id?: string | null;
  title: string;
  description?: string;
  quantity_needed?: number;
  priority?: NeedPriority;
}

// ---------- CRUD ----------

export async function fetchCenterNeeds(centerId: string): Promise<CenterNeed[]> {
  const { data, error } = await supabase
    .from('center_needs')
    .select('*')
    .eq('center_id', centerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      console.warn('Tabla center_needs no encontrada en Supabase. Retornando lista vacía.');
      return [];
    }
    throw error;
  }
  return (data ?? []) as CenterNeed[];
}

export async function createCenterNeed(
  centerId: string,
  input: CenterNeedInput,
): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('center_needs').insert({
    id,
    center_id: centerId,
    item_type: input.item_type,
    item_id: input.item_id ?? null,
    title: input.title,
    description: input.description ?? '',
    quantity_needed: input.quantity_needed ?? 0,
    quantity_received: 0,
    priority: input.priority ?? 'medium',
    status: 'active',
    source: 'manual',
    created_at: nowISO(),
    updated_at: nowISO(),
  });
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error('La tabla "center_needs" no existe en Supabase. Ejecuta la migración SQL en tu proyecto.');
    }
    throw error;
  }
  return id;
}

export async function updateCenterNeed(
  needId: string,
  data: Partial<Pick<CenterNeed, 'title' | 'description' | 'quantity_needed' | 'priority' | 'status'>>,
): Promise<void> {
  const { error } = await supabase
    .from('center_needs')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', needId);
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error('La tabla "center_needs" no existe en Supabase. Ejecuta la migración SQL en tu proyecto.');
    }
    throw error;
  }
}

export async function deleteCenterNeed(needId: string): Promise<void> {
  const { error } = await supabase
    .from('center_needs')
    .update({ status: 'cancelled', updated_at: nowISO() })
    .eq('id', needId);
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error('La tabla "center_needs" no existe en Supabase. Ejecuta la migración SQL en tu proyecto.');
    }
    throw error;
  }
}
