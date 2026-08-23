import { supabase } from './supabase';
import { getDeviceId, newId, nowISO } from './ids';

// ---------- Types ----------

export type Scope = 'product' | 'medication';
export type ItemType = 'product' | 'medication' | 'kit';
export type MovementKind = 'entrada' | 'salida';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon_key: string;
  order: number;
  scope: Scope;
  is_active: boolean;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  scope: Scope;
  is_active: boolean;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  aliases: string[];
  category_id: string | null;
  unit_id: string;
  min_stock: number | null;
  total_stock: number;
  is_active: boolean;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  name: string;
  presentacion: string;
  categoria_id: string | null;
  unit_id: string;
  is_active: boolean;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationLot {
  id: string;
  medication_id: string;
  lote: string;
  fecha_vencimiento: string | null;
  stock: number;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Movement {
  id: string;
  kind: MovementKind;
  item_type: ItemType;
  item_id: string;
  qty: number;
  unit_id: string;
  lote_id: string | null;
  fecha: string;
  operador_id: string | null;
  nota: string;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Kit {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string;
  total_stock: number;
  is_active: boolean;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KitComponent {
  id: string;
  kit_id: string;
  product_id: string;
  qty: number;
  unit_id: string;
  order: number;
}

export interface KitBuild {
  id: string;
  kit_id: string;
  qty: number;
  fecha: string;
  operador_id: string | null;
  nota: string;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KitDelivery {
  id: string;
  kit_id: string;
  qty: number;
  fecha: string;
  operador_id: string | null;
  nota: string;
  deleted: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Operador {
  id: string;
  name: string;
  is_active: boolean;
  center_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Helpers ----------

// ponytail: schema requires device_id/client_uuid/version NOT NULL. The id (also a
// client-generated UUID) is reused as client_uuid so the unique (device_id, client_uuid)
// constraint doesn't collide between rows on the same device.
function insertMeta(id: string) {
  return {
    device_id: getDeviceId(),
    client_uuid: id,
    version: 1,
    deleted: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}

// ---------- Categories ----------

export async function fetchCategories(scope?: Scope): Promise<Category[]> {
  let q = supabase.from('categories').select('*').eq('deleted', false).order('order');
  if (scope) q = q.eq('scope', scope);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(
  name: string,
  scope: Scope,
  iconKey: string,
  order: number,
  color: string,
  centerId: string,
): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('categories').insert({
    id,
    name,
    color,
    icon_key: iconKey,
    order,
    scope,
    is_active: true,
    center_id: centerId,
    ...insertMeta(id),
  });
  if (error) throw error;
  return id;
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'color' | 'icon_key' | 'order' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Units ----------

export async function fetchUnits(scope?: Scope): Promise<Unit[]> {
  let q = supabase.from('units').select('*').eq('deleted', false).order('name');
  if (scope) q = q.eq('scope', scope);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createUnit(
  name: string,
  scope: Scope,
  abbreviation: string | undefined,
  centerId: string,
): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('units').insert({
    id,
    name,
    scope,
    abbreviation: abbreviation ?? name.toLowerCase().slice(0, 4),
    is_active: true,
    center_id: centerId,
    ...insertMeta(id),
  });
  if (error) throw error;
  return id;
}

export async function updateUnit(
  id: string,
  data: Partial<Pick<Unit, 'name' | 'abbreviation' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteUnit(id: string): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Products ----------

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('deleted', false)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createProduct(
  data: Omit<Product, 'deleted' | 'created_at' | 'updated_at'>,
): Promise<string> {
  const { error } = await supabase.from('products').insert({
    ...data,
    is_active: true,
    ...insertMeta(data.id),
  });
  if (error) throw error;
  return data.id;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted: false, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Medications ----------

export async function fetchMedications(): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('deleted', false)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMedication(id: string): Promise<Medication | null> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createMedication(
  data: Omit<Medication, 'deleted' | 'created_at' | 'updated_at'>,
): Promise<string> {
  const { error } = await supabase.from('medications').insert({
    ...data,
    is_active: true,
    ...insertMeta(data.id),
  });
  if (error) throw error;
  return data.id;
}

export async function updateMedication(
  id: string,
  data: Partial<Omit<Medication, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Medication Lots ----------

export async function fetchLots(medicationId: string): Promise<MedicationLot[]> {
  const { data, error } = await supabase
    .from('medication_lots')
    .select('*')
    .eq('medication_id', medicationId)
    .eq('deleted', false)
    .order('fecha_vencimiento', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLot(id: string): Promise<MedicationLot | null> {
  const { data, error } = await supabase
    .from('medication_lots')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createLot(
  data: Omit<MedicationLot, 'deleted' | 'created_at' | 'updated_at'>,
): Promise<string> {
  const { error } = await supabase.from('medication_lots').insert({
    ...data,
    ...insertMeta(data.id),
  });
  if (error) throw error;
  return data.id;
}

export async function updateLot(
  id: string,
  data: Partial<Omit<MedicationLot, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('medication_lots')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLot(id: string): Promise<void> {
  const { error } = await supabase
    .from('medication_lots')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Movements ----------

export async function createMovement(row: {
  kind: MovementKind;
  item_type: ItemType;
  item_id: string;
  qty: number;
  unit_id: string;
  lote_id: string | null;
  fecha: string;
  nota: string;
  center_id: string;
}): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('movements').insert({
    id,
    ...row,
    operador_id: null,
    ...insertMeta(id),
  });
  if (error) throw error;
  return id;
}

export async function fetchMovements(opts?: {
  limit?: number;
  itemType?: ItemType;
  since?: string;
}): Promise<Movement[]> {
  let q = supabase
    .from('movements')
    .select('*')
    .eq('deleted', false)
    .order('fecha', { ascending: false });
  if (opts?.itemType) q = q.eq('item_type', opts.itemType);
  if (opts?.since) q = q.gte('fecha', opts.since);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ---------- Kits ----------

export async function fetchKits(): Promise<Kit[]> {
  const { data, error } = await supabase
    .from('kits')
    .select('*')
    .eq('deleted', false)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchKit(id: string): Promise<Kit | null> {
  const { data, error } = await supabase
    .from('kits')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createKit(
  data: Omit<Kit, 'deleted' | 'created_at' | 'updated_at'>,
): Promise<string> {
  const { error } = await supabase.from('kits').insert({
    ...data,
    is_active: true,
    ...insertMeta(data.id),
  });
  if (error) throw error;
  return data.id;
}

export async function updateKit(
  id: string,
  data: Partial<Omit<Kit, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('kits')
    .update({ ...data, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteKit(id: string): Promise<void> {
  const { error } = await supabase
    .from('kits')
    .update({ deleted: true, updated_at: nowISO() })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Kit Components ----------

export async function fetchKitComponents(kitId: string): Promise<KitComponent[]> {
  const { data, error } = await supabase
    .from('kit_components')
    .select('*')
    .eq('kit_id', kitId)
    .order('order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllKitComponents(): Promise<KitComponent[]> {
  const { data, error } = await supabase
    .from('kit_components')
    .select('*')
    .order('order');
  if (error) throw error;
  return data ?? [];
}

export async function addKitComponent(
  data: Omit<KitComponent, 'id'>,
): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('kit_components').insert({ id, ...data });
  if (error) throw error;
  return id;
}

export async function removeKitComponent(id: string): Promise<void> {
  const { error } = await supabase.from('kit_components').delete().eq('id', id);
  if (error) throw error;
}

export async function clearKitComponents(kitId: string): Promise<void> {
  const { error } = await supabase.from('kit_components').delete().eq('kit_id', kitId);
  if (error) throw error;
}

// ---------- Kit Builds & Deliveries ----------

export async function createKitBuild(kitId: string, qty: number, fecha: string, centerId: string): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('kit_builds').insert({
    id,
    kit_id: kitId,
    qty,
    fecha,
    operador_id: null,
    nota: '',
    center_id: centerId,
    ...insertMeta(id),
  });
  if (error) throw error;
  return id;
}

export async function createKitDelivery(kitId: string, qty: number, fecha: string, centerId: string): Promise<string> {
  const id = newId();
  const { error } = await supabase.from('kit_deliveries').insert({
    id,
    kit_id: kitId,
    qty,
    fecha,
    operador_id: null,
    nota: '',
    center_id: centerId,
    ...insertMeta(id),
  });
  if (error) throw error;
  return id;
}

export async function fetchKitBuilds(kitId: string): Promise<KitBuild[]> {
  const { data, error } = await supabase
    .from('kit_builds')
    .select('*')
    .eq('kit_id', kitId)
    .eq('deleted', false)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchKitDeliveries(kitId: string): Promise<KitDelivery[]> {
  const { data, error } = await supabase
    .from('kit_deliveries')
    .select('*')
    .eq('kit_id', kitId)
    .eq('deleted', false)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------- Operadores ----------

export async function fetchOperadores(): Promise<Operador[]> {
  const { data, error } = await supabase
    .from('operadores')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// ---------- Import RPCs ----------

export async function importProductsFromRows(
  rows: Array<{ product: string; category: string; qty: number; unit?: string }>,
  userId?: string,
  centerId?: string,
): Promise<{ ok: number; createdCats: number; createdUnits: number; productsCreated: number; productsUpdated: number }> {
  const { data, error } = await supabase.rpc('import_products_from_rows', {
    p_rows: rows,
    p_user_id: userId ?? null,
    p_center_id: centerId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function importMedicationsFromRows(
  rows: Array<{
    medication: string;
    category: string;
    qty: number;
    unit?: string;
    presentation?: string;
    lot?: string;
    expiry?: string;
  }>,
  userId?: string,
  centerId?: string,
): Promise<{
  ok: number;
  createdCats: number;
  createdUnits: number;
  medsCreated: number;
  medsUpdated: number;
  lotsCreated: number;
}> {
  const { data, error } = await supabase.rpc('import_medications_from_rows', {
    p_rows: rows,
    p_user_id: userId ?? null,
    p_center_id: centerId ?? null,
  });
  if (error) throw error;
  return data;
}

// ---------- Import Volunteers ----------

export async function importVolunteersFromRows(
  rows: Array<{
    full_name: string;
    phone?: string;
    email?: string;
    id_number?: string;
    skills?: string;
    availability?: string;
  }>,
  centerId: string,
): Promise<{ ok: number; created: number; skipped: number }> {
  const { data, error } = await supabase.rpc('import_volunteers_from_rows', {
    p_rows: rows,
    p_center_id: centerId,
  });
  if (error) throw error;
  return data;
}
