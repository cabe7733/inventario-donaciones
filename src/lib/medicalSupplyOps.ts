import { supabase } from './supabase';

export interface MedicalSupply {
  id: string;
  center_id: string;
  name: string;
  category: string;
  unit_id: string | null;
  min_stock: number | null;
  is_active: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicalSupplyLot {
  id: string;
  supply_id: string;
  center_id: string;
  lote: string;
  fecha_vencimiento: string | null;
  stock: number;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchMedicalSupplies(): Promise<MedicalSupply[]> {
  const { data, error } = await supabase.from('medical_supplies').select('*').eq('deleted', false).eq('is_active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createMedicalSupply(input: Pick<MedicalSupply, 'name' | 'category' | 'unit_id' | 'min_stock' | 'center_id'>): Promise<string> {
  const { data, error } = await supabase.from('medical_supplies').insert({ ...input, is_active: true, deleted: false }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateMedicalSupply(id: string, input: Partial<Pick<MedicalSupply, 'name' | 'category' | 'unit_id' | 'min_stock' | 'is_active'>>): Promise<void> {
  const { error } = await supabase.from('medical_supplies').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteMedicalSupply(id: string): Promise<void> {
  const { error } = await supabase.from('medical_supplies').update({ deleted: true, is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function fetchMedicalSupplyLots(supplyId: string): Promise<MedicalSupplyLot[]> {
  const { data, error } = await supabase.from('medical_supply_lots').select('*').eq('supply_id', supplyId).eq('deleted', false).order('fecha_vencimiento', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMedicalSupplyLotsBulk(supplyIds: string[]): Promise<Map<string, MedicalSupplyLot[]>> {
  if (supplyIds.length === 0) return new Map();
  const { data, error } = await supabase.from('medical_supply_lots').select('*').in('supply_id', supplyIds).eq('deleted', false).order('fecha_vencimiento', { ascending: true });
  if (error) throw error;
  const map = new Map<string, MedicalSupplyLot[]>();
  for (const id of supplyIds) map.set(id, []);
  for (const lot of data ?? []) {
    const list = map.get(lot.supply_id);
    if (list) list.push(lot);
  }
  return map;
}

export async function registerMedicalSupplyEntry(input: { supplyId: string; lote: string; expiry: string | null; qty: number; warehouseId: string; fecha: string; nota?: string }): Promise<void> {
  const { error } = await supabase.rpc('register_medical_supply_entry', {
    p_supply_id: input.supplyId,
    p_lote: input.lote,
    p_expiry: input.expiry,
    p_qty: input.qty,
    p_warehouse_id: input.warehouseId,
    p_fecha: input.fecha,
    p_nota: input.nota ?? '',
  });
  if (error) throw error;
}

export async function registerMedicalSupplyExit(input: { supplyId: string; qty: number; warehouseId: string; recipientId: string; fecha: string; nota?: string }): Promise<void> {
  const { error } = await supabase.rpc('register_medical_supply_exit', {
    p_supply_id: input.supplyId,
    p_qty: input.qty,
    p_warehouse_id: input.warehouseId,
    p_recipient_id: input.recipientId,
    p_fecha: input.fecha,
    p_nota: input.nota ?? '',
  });
  if (error) throw error;
}

export function medicalSupplyStock(lots: MedicalSupplyLot[]): number {
  return lots.reduce((total, lot) => total + Number(lot.stock), 0);
}
