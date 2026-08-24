import { supabase } from './supabase';
import { round2, StockError } from './movements';
import { newId, nowISO } from './ids';
import type { ItemType } from './db';

export interface Warehouse {
  id: string;
  center_id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseReportRow {
  item_type: 'product' | 'medication' | 'kit';
  item_id: string;
  item_name: string;
  total_in: number;
  total_out: number;
  current_stock: number;
}

export async function fetchWarehouses(includeInactive = false): Promise<Warehouse[]> {
  let q = supabase.from('warehouses').select('*').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchWarehouseByCode(
  code: string,
  centerId: string,
): Promise<Warehouse | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('center_id', centerId)
    .eq('is_active', true)
    .single();
  if (error) return null;
  return data;
}

export async function createWarehouse(
  row: Pick<Warehouse, 'center_id' | 'name'> & { code?: string; address?: string },
): Promise<Warehouse> {
  const code = row.code ?? (await nextWarehouseCode(row.center_id));
  const { data, error } = await supabase
    .from('warehouses')
    .insert({ ...row, code: code.trim().toUpperCase() })
    .select('*')
    .single();
  if (error) throw error;
  return data as Warehouse;
}

export async function updateWarehouse(
  id: string,
  updates: Partial<Pick<Warehouse, 'name' | 'code' | 'address' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase
    .from('warehouses')
    .update(updates.code ? { ...updates, code: updates.code.trim().toUpperCase() } : updates)
    .eq('id', id);
  if (error) throw error;
}

// ponytail: baja lógica; borrar bodegas con movimientos rompería FKs de orders/movements.
export async function deactivateWarehouse(id: string): Promise<void> {
  await updateWarehouse(id, { is_active: false });
}

export async function nextWarehouseCode(centerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_warehouse_code', {
    p_center_id: centerId,
  });
  if (error) throw error;
  return (data as string) ?? 'BOD-01';
}

export async function toggleWarehouseActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('toggle_warehouse_active', {
    p_warehouse_id: id,
    p_active: active,
  });
  if (error) throw error;
}

export async function fetchWarehouseReport(
  warehouseId: string,
  from?: string,
  to?: string,
): Promise<WarehouseReportRow[]> {
  const { data, error } = await supabase.rpc('get_warehouse_report', {
    p_warehouse_id: warehouseId,
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

// Ponytail: stock en bodega derivado de movements (entrada=salida=0 → no hay cambio de stock global).
export async function warehouseStock(
  warehouseId: string,
  itemType: ItemType,
  itemId: string,
  loteId?: string | null,
): Promise<number> {
  let q = supabase
    .from('movements')
    .select('kind, qty')
    .eq('warehouse_id', warehouseId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .eq('deleted', false);
  if (loteId !== undefined) {
    q = loteId ? q.eq('lote_id', loteId) : q.is('lote_id', null);
  }
  const { data, error } = await q;
  if (error) throw error;
  let total = 0;
  for (const m of data ?? []) {
    total += m.kind === 'entrada' ? m.qty : -m.qty;
  }
  return round2(total);
}

// Stock en bodega por todos los ítems. Una sola query (sum agregada) en vez de N+1.
// Devuelve Map keyed por `${item_type}:${item_id}`. Items sin movimientos no aparecen.
export async function warehouseStocksBulk(
  warehouseId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('movements')
    .select('item_type, item_id, kind, qty')
    .eq('warehouse_id', warehouseId)
    .eq('deleted', false);
  if (error) throw error;
  const acc = new Map<string, number>();
  for (const m of data ?? []) {
    const key = `${m.item_type}:${m.item_id}`;
    const delta = m.kind === 'entrada' ? m.qty : -m.qty;
    acc.set(key, round2((acc.get(key) ?? 0) + delta));
  }
  return acc;
}

// Stock en bodega por un ítem con sus lotes (medicamentos). Devuelve stock por lote.
export async function warehouseStockByLot(
  warehouseId: string,
  itemId: string,
): Promise<Array<{ loteId: string; qty: number }>> {
  const { data, error } = await supabase
    .from('movements')
    .select('kind, qty, lote_id')
    .eq('warehouse_id', warehouseId)
    .eq('item_type', 'medication')
    .eq('item_id', itemId)
    .eq('deleted', false);
  if (error) throw error;
  const byLot = new Map<string, number>();
  for (const m of data ?? []) {
    const key = m.lote_id ?? '__global__';
    byLot.set(key, (byLot.get(key) ?? 0) + (m.kind === 'entrada' ? m.qty : -m.qty));
  }
  return [...byLot.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([loteId, qty]) => ({ loteId, qty: round2(qty) }));
}

// Traslado entre bodegas: dos movements (salida + entrada) misma fecha.
export async function transferStock(args: {
  warehouseOriginId: string;
  warehouseDestId: string;
  itemType: ItemType;
  itemId: string;
  loteId: string | null;
  qty: number;
  unitId: string;
  fecha: string;
  centerId: string;
  nota: string;
}): Promise<void> {
  const qty = round2(args.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');
  if (args.warehouseOriginId === args.warehouseDestId) {
    throw new StockError('Origen y destino deben ser diferentes');
  }

  // Validate stock in origin
  const stock = await warehouseStock(
    args.warehouseOriginId,
    args.itemType,
    args.itemId,
    args.loteId,
  );
  if (stock < qty) {
    throw new StockError(`Stock insuficiente en bodega origen. Disponible: ${stock}`);
  }

  const notaOrigen = `Traslado → ${args.nota}`;
  const notaDestino = `Traslado ← ${args.nota}`;

  // Salida en origen
  const id1 = newId();
  const { error: e1 } = await supabase.from('movements').insert({
    id: id1,
    kind: 'salida',
    item_type: args.itemType,
    item_id: args.itemId,
    qty,
    unit_id: args.unitId,
    lote_id: args.loteId,
    fecha: args.fecha,
    operador_id: null,
    nota: notaOrigen,
    center_id: args.centerId,
    warehouse_id: args.warehouseOriginId,
    deleted: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  });
  if (e1) throw e1;

  // Entrada en destino
  const id2 = newId();
  const { error: e2 } = await supabase.from('movements').insert({
    id: id2,
    kind: 'entrada',
    item_type: args.itemType,
    item_id: args.itemId,
    qty,
    unit_id: args.unitId,
    lote_id: args.loteId,
    fecha: args.fecha,
    operador_id: null,
    nota: notaDestino,
    center_id: args.centerId,
    warehouse_id: args.warehouseDestId,
    deleted: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  });
  if (e2) throw e2;
}
