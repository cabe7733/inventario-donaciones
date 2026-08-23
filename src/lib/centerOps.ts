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
