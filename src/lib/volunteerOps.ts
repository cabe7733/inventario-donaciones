import { supabase } from './supabase';

export interface Volunteer {
  id: string;
  center_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  skills: string[] | null;
  availability: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchVolunteers(): Promise<Volunteer[]> {
  const { data, error } = await supabase
    .from('volunteers')
    .select('*')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

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
  return data as { ok: number; created: number; skipped: number };
}

export async function createVolunteer(volunteer: Omit<Volunteer, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('volunteers')
    .insert(volunteer)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateVolunteer(id: string, updates: Partial<Pick<Volunteer, 'full_name' | 'phone' | 'email' | 'id_number' | 'skills' | 'availability' | 'is_active'>>): Promise<void> {
  const { error } = await supabase
    .from('volunteers')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVolunteer(id: string): Promise<void> {
  const { error } = await supabase
    .from('volunteers')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}
