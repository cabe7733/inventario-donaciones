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
export type NeedItemType = 'product' | 'medication' | 'medical_supply';
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
  const { data, error } = await supabase.rpc('get_public_centers');
  if (error) throw error;
  return (data ?? []) as PublicCenter[];
}

export async function fetchPublicCenterBySlug(slug: string): Promise<PublicCenter | null> {
  const { data, error } = await supabase.rpc('get_public_center_by_slug', {
    p_slug: slug,
  });
  if (error) return null;
  if (!data || data.length === 0) return null;
  return data[0] as PublicCenter;
}

export async function fetchPublicNeeds(centerId?: string): Promise<PublicNeed[]> {
  const { data, error } = await supabase.rpc('get_public_needs', {
    p_center_id: centerId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PublicNeed[];
}

// ---------- Inventory sync ----------

export async function syncNeedFromInventory(needId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_need_from_inventory', {
    p_need_id: needId,
  });
  if (error) throw error;
}

export async function syncCenterNeedsFromInventory(centerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_center_needs_from_inventory', {
    p_center_id: centerId,
  });
  if (error) throw error;
  return data as number;
}
