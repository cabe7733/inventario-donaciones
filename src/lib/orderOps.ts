import { supabase } from './supabase';

export interface Order {
  id: string;
  center_id: string;
  warehouse_id: string;
  order_type: 'entrada' | 'salida';
  donor_id: string | null;
  recipient_id: string | null;
  donor_full_name: string | null;
  donor_id_number: string | null;
  donor_phone: string | null;
  donor_email: string | null;
  donor_entity_name: string | null;
  donor_entity_rfc: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
  vehicle_color: string | null;
  recipient_full_name: string | null;
  recipient_id_number: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_entity_name: string | null;
  recipient_entity_rfc: string | null;
  recipient_type: string | null;
  created_by: string;
  order_date: string;
  notes: string;
  created_at: string;
  updated_at?: string;
  deleted?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_type: 'product' | 'medication' | 'kit';
  item_id: string;
  qty: number;
  unit_id: string | null;
  lote_id: string | null;
  notes: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderWithRefs extends Order {
  warehouses: { name: string } | null;
  donors: { full_name: string } | null;
  recipients: { full_name: string } | null;
  order_items: OrderItem[];
}

export async function fetchOrders(
  type?: 'entrada' | 'salida',
  opts?: { warehouseId?: string },
): Promise<OrderWithRefs[]> {
  let q = supabase
    .from('orders')
    .select('*, warehouses(name), donors(full_name), recipients(full_name), order_items(*)')
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (type) {
    q = q.eq('order_type', type);
  }
  if (opts?.warehouseId) {
    q = q.eq('warehouse_id', opts.warehouseId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as OrderWithRefs[];
}

export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  return data;
}

export interface CreateOrderInput {
  order_type: 'entrada' | 'salida';
  warehouse_id: string;
  donor_id?: string;
  recipient_id?: string;
  donor_full_name?: string;
  donor_id_number?: string;
  donor_phone?: string;
  donor_email?: string;
  donor_entity_name?: string;
  donor_entity_rfc?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  vehicle_color?: string;
  recipient_full_name?: string;
  recipient_id_number?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_entity_name?: string;
  recipient_entity_rfc?: string;
  recipient_type?: 'person' | 'entity';
  items: Array<{
    item_type: 'product' | 'medication' | 'kit';
    item_id: string;
    qty: number;
    unit_id?: string;
    lote_id?: string;
    notes?: string;
  }>;
  notes?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_order', {
    p_order_type: input.order_type,
    p_warehouse_id: input.warehouse_id,
    p_items: input.items,
    p_donor_id: input.donor_id ?? null,
    p_recipient_id: input.recipient_id ?? null,
    p_donor_full_name: input.donor_full_name,
    p_donor_id_number: input.donor_id_number,
    p_donor_phone: input.donor_phone,
    p_donor_email: input.donor_email,
    p_donor_entity_name: input.donor_entity_name,
    p_donor_entity_rfc: input.donor_entity_rfc,
    p_vehicle_plate: input.vehicle_plate,
    p_vehicle_type: input.vehicle_type,
    p_vehicle_color: input.vehicle_color,
    p_recipient_full_name: input.recipient_full_name,
    p_recipient_id_number: input.recipient_id_number,
    p_recipient_phone: input.recipient_phone,
    p_recipient_email: input.recipient_email,
    p_recipient_entity_name: input.recipient_entity_name,
    p_recipient_entity_rfc: input.recipient_entity_rfc,
    p_recipient_type: input.recipient_type,
    p_notes: input.notes,
  });

  if (error) throw error;
  return data;
}

// ponytail: replace_order/delete_order son super_admin-only (la RLS y la RPC
// lo validan). No hace falta gating extra en el cliente, pero conviene
// deshabilitar los botones si role !== 'super_admin' para UX.
export async function replaceOrder(orderId: string, input: Omit<CreateOrderInput, 'order_type'>): Promise<void> {
  const { error } = await supabase.rpc('replace_order', {
    p_order_id: orderId,
    p_warehouse_id: input.warehouse_id,
    p_items: input.items,
    p_donor_id: input.donor_id ?? null,
    p_recipient_id: input.recipient_id ?? null,
    p_donor_full_name: input.donor_full_name,
    p_donor_id_number: input.donor_id_number,
    p_donor_phone: input.donor_phone,
    p_donor_email: input.donor_email,
    p_donor_entity_name: input.donor_entity_name,
    p_donor_entity_rfc: input.donor_entity_rfc,
    p_vehicle_plate: input.vehicle_plate,
    p_vehicle_type: input.vehicle_type,
    p_vehicle_color: input.vehicle_color,
    p_recipient_full_name: input.recipient_full_name,
    p_recipient_id_number: input.recipient_id_number,
    p_recipient_phone: input.recipient_phone,
    p_recipient_email: input.recipient_email,
    p_recipient_entity_name: input.recipient_entity_name,
    p_recipient_entity_rfc: input.recipient_entity_rfc,
    p_recipient_type: input.recipient_type,
    p_notes: input.notes,
  });

  if (error) throw error;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_order', {
    p_order_id: orderId,
  });

  if (error) throw error;
}
