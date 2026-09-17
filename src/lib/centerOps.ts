import { supabase } from './supabase';

export interface Center {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  entity_type: 'person' | 'entity' | null;
  entity_name: string | null;
  entity_rfc: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  representative_email: string | null;
}

export interface CenterUpdate {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  entity_type: 'person' | 'entity';
  entity_name: string;
  entity_rfc: string;
  representative_name: string;
  representative_phone: string;
  representative_email: string;
}

// ---------- Public types ----------

export type NeedPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NeedStatus = 'active' | 'fulfilled' | 'cancelled';
export type NeedItemType = 'product' | 'medication' | 'medical_supply' | 'volunteer';
export type NeedSource = 'inventory' | 'manual';
export type StockLevel = 'available' | 'sufficient' | 'moderate' | 'low' | 'critical';

export interface PublicCenter {
  id: string;
  name: string;
  slug: string | null;
  public_description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  public_phone: string | null;
  public_email: string | null;
  operating_hours: string | null;
  accepts_donations: boolean;
  total_products: number;
  total_medications: number;
  total_volunteers: number;
  total_needs: number;
  created_at: string;
  updated_at: string;
}

export interface PublicNeed {
  id: string;
  center_id: string;
  center_name: string;
  center_city: string | null;
  center_state: string | null;
  center_slug: string | null;
  item_type: NeedItemType;
  title: string;
  description: string | null;
  quantity_needed: number;
  quantity_received: number;
  quantity_remaining: number;
  priority: NeedPriority;
  stock_level: StockLevel;
  source: NeedSource;
  created_at: string;
  updated_at: string;
}

// ---------- Private operations ----------

export async function fetchCenter(centerId: string): Promise<Center | null> {
  const { data, error } = await supabase
    .from('centers')
    .select('*')
    .eq('id', centerId)
    .single();
  if (error) return null;
  return data as Center;
}

export async function updateCenter(input: CenterUpdate): Promise<void> {
  const { error } = await supabase.rpc('update_center', {
    p_name: input.name,
    p_address: input.address,
    p_city: input.city,
    p_state: input.state,
    p_phone: input.phone,
    p_email: input.email,
    p_entity_type: input.entity_type,
    p_entity_name: input.entity_name,
    p_entity_rfc: input.entity_rfc,
    p_representative_name: input.representative_name,
    p_representative_phone: input.representative_phone,
    p_representative_email: input.representative_email,
  });
  if (error) throw error;
}

// ---------- Public operations ----------

export async function fetchPublicCenters(): Promise<PublicCenter[]> {
  try {
    const { data, error } = await supabase.rpc('get_public_centers');
    if (!error && data && data.length > 0) {
      return data as PublicCenter[];
    }
  } catch {
    // ignore
  }

  // Fallback 1: Query public_center_details view
  try {
    const { data, error } = await supabase.from('public_center_details').select('*');
    if (!error && data && data.length > 0) {
      return data as PublicCenter[];
    }
  } catch {
    // ignore
  }

  // Fallback 2: Query centers table directly
  const { data, error } = await supabase
    .from('centers')
    .select('*')
    .or('is_active.is.null,is_active.eq.true');

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug || c.id,
    public_description: c.description || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    public_phone: c.phone || '',
    public_email: c.email || '',
    operating_hours: c.operating_hours || 'Lunes a Sábado: 8:00 AM - 5:00 PM',
    accepts_donations: c.accepts_donations ?? true,
    total_products: 0,
    total_medications: 0,
    total_volunteers: 0,
    total_needs: 0,
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  }));
}

export async function fetchPublicCenterBySlug(slug: string): Promise<PublicCenter | null> {
  try {
    const { data, error } = await supabase.rpc('get_public_center_by_slug', {
      p_slug: slug,
    });
    if (!error && data && data.length > 0) {
      return data[0] as PublicCenter;
    }
  } catch {
    // ignore
  }

  const centers = await fetchPublicCenters();
  return centers.find((c) => c.slug === slug || c.id === slug) || null;
}

export async function fetchPublicCenterById(idOrSlug: string): Promise<PublicCenter | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  if (!isUuid) {
    return fetchPublicCenterBySlug(idOrSlug);
  }

  try {
    const { data, error } = await supabase
      .from('public_center_details')
      .select('*')
      .eq('id', idOrSlug)
      .maybeSingle();
    if (!error && data) {
      return data as PublicCenter;
    }
  } catch {
    // ignore
  }

  const centers = await fetchPublicCenters();
  return centers.find((c) => c.id === idOrSlug || c.slug === idOrSlug) || null;
}

export async function fetchPublicNeeds(centerId?: string): Promise<PublicNeed[]> {
  try {
    const { data, error } = await supabase.rpc('get_public_needs', {
      p_center_id: centerId ?? null,
    });
    if (!error && data && data.length > 0) {
      return data as PublicNeed[];
    }
  } catch {
    // ignore
  }

  // Fallback: Query center_needs and public_inventory_needs
  const results: PublicNeed[] = [];

  try {
    let invQuery = supabase.from('public_inventory_needs').select('*');
    if (centerId) invQuery = invQuery.eq('center_id', centerId);
    const { data: invData } = await invQuery;

    if (invData) {
      for (const item of invData) {
        results.push({
          id: item.item_id || String(Math.random()),
          center_id: item.center_id,
          center_name: 'Centro de Acopio',
          center_city: '',
          center_state: '',
          center_slug: '',
          item_type: item.item_type || 'product',
          title: item.title,
          description: item.description,
          quantity_needed: Number(item.quantity_needed || 0),
          quantity_received: Number(item.quantity_received || 0),
          quantity_remaining: Math.max(0, Number(item.quantity_needed || 0) - Number(item.quantity_received || 0)),
          priority: item.priority || 'urgent',
          stock_level: 'critical',
          source: item.source || 'inventory',
          created_at: item.updated_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    let cnQuery = supabase.from('center_needs').select('*').eq('status', 'active');
    if (centerId) cnQuery = cnQuery.eq('center_id', centerId);
    const { data: cnData } = await cnQuery;

    if (cnData) {
      for (const item of cnData) {
        results.push({
          id: item.id,
          center_id: item.center_id,
          center_name: 'Centro de Acopio',
          center_city: '',
          center_state: '',
          center_slug: '',
          item_type: item.item_type || 'product',
          title: item.title,
          description: item.description,
          quantity_needed: Number(item.quantity_needed || 0),
          quantity_received: Number(item.quantity_received || 0),
          quantity_remaining: Math.max(0, Number(item.quantity_needed || 0) - Number(item.quantity_received || 0)),
          priority: item.priority || 'medium',
          stock_level: 'moderate',
          source: item.source || 'manual',
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore
  }

  return results;
}

// ---------- Inventory sync ----------

async function fallbackSyncNeedFromInventory(needId: string): Promise<void> {
  const { data: need, error: fetchErr } = await supabase
    .from('center_needs')
    .select('id, item_type, item_id, quantity_needed')
    .eq('id', needId)
    .single();

  if (fetchErr || !need || !need.item_id) return;

  let currentStock = 0;
  if (need.item_type === 'product') {
    const { data: prod } = await supabase
      .from('products')
      .select('total_stock')
      .eq('id', need.item_id)
      .single();
    currentStock = prod?.total_stock ?? 0;
  } else if (need.item_type === 'medication') {
    const { data: lots } = await supabase
      .from('medication_lots')
      .select('stock')
      .eq('medication_id', need.item_id)
      .eq('deleted', false);
    currentStock = (lots ?? []).reduce((acc: number, l: { stock: number }) => acc + (Number(l.stock) || 0), 0);
  } else if (need.item_type === 'medical_supply') {
    const { data: lots } = await supabase
      .from('medical_supply_lots')
      .select('stock')
      .eq('supply_id', need.item_id)
      .eq('deleted', false);
    currentStock = (lots ?? []).reduce((acc: number, l: { stock: number }) => acc + (Number(l.stock) || 0), 0);
  }

  const status = currentStock >= need.quantity_needed ? 'fulfilled' : 'active';
  await supabase
    .from('center_needs')
    .update({
      quantity_received: currentStock,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', needId);
}

async function fallbackSyncCenterNeedsFromInventory(centerId: string): Promise<number> {
  const { data: needs, error } = await supabase
    .from('center_needs')
    .select('id')
    .eq('center_id', centerId)
    .eq('status', 'active')
    .not('item_id', 'is', null);

  if (error || !needs || needs.length === 0) return 0;

  for (const n of needs) {
    await fallbackSyncNeedFromInventory(n.id);
  }
  return needs.length;
}

export async function syncNeedFromInventory(needId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_need_from_inventory', {
    p_need_id: needId,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      await fallbackSyncNeedFromInventory(needId);
      return;
    }
    throw error;
  }
}

export async function syncCenterNeedsFromInventory(centerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_center_needs_from_inventory', {
    p_center_id: centerId,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return await fallbackSyncCenterNeedsFromInventory(centerId);
    }
    throw error;
  }
  return data as number;
}
