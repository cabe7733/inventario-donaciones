import { supabase } from './supabase';

export type ItemKind = 'entrada' | 'salida';
export type ItemType = 'product' | 'medication' | 'kit';

// ================= DONACIONES POR BODEGA =================

export interface WarehouseDonationRow {
  movement_id: string;
  fecha: string;
  kind: ItemKind;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  qty: number;
  donor_name: string | null;
  recipient_name: string | null;
  nota: string | null;
}

export async function fetchWarehouseDonationsReport(
  warehouseId: string,
  opts?: { from?: string; to?: string; kind?: ItemKind },
): Promise<WarehouseDonationRow[]> {
  const { data, error } = await supabase.rpc('get_warehouse_donations_report', {
    p_warehouse_id: warehouseId,
    p_from: opts?.from ?? null,
    p_to: opts?.to ?? null,
    p_kind: opts?.kind ?? null,
  });
  if (error) throw error;
  return (data ?? []) as WarehouseDonationRow[];
}

// ================= INFORME GENERAL =================

export interface GeneralReportRow {
  item_type: ItemType;
  item_id: string;
  item_name: string;
  total_in: number;
  total_out: number;
  current_stock: number;
  warehouse_count: number;
}

export async function fetchGeneralReport(from?: string, to?: string): Promise<GeneralReportRow[]> {
  const { data, error } = await supabase.rpc('get_general_report', {
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error) throw error;
  return (data ?? []) as GeneralReportRow[];
}

// ================= PRODUCTOS × BODEGA =================

export interface ProductWarehouseCell {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  stock: number;
}

export async function fetchProductsByWarehouseMatrix(): Promise<ProductWarehouseCell[]> {
  const { data, error } = await supabase.rpc('get_products_by_warehouse_matrix');
  if (error) throw error;
  return (data ?? []) as ProductWarehouseCell[];
}

// ================= KITS × BODEGA =================

export interface KitWarehouseCell {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  kit_id: string;
  kit_name: string;
  stock: number;
}

export async function fetchKitsByWarehouseMatrix(): Promise<KitWarehouseCell[]> {
  const { data, error } = await supabase.rpc('get_kits_by_warehouse_matrix');
  if (error) throw error;
  return (data ?? []) as KitWarehouseCell[];
}
