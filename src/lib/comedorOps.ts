import { supabase } from './supabase';

export interface ComedorPerson {
  id: string;
  center_id: string;
  nombre: string;
  apellido: string | null;
  celular: string | null;
  numero_documento: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComedorVisit {
  id: string;
  person_id: string;
  visit_date: string;
}

export async function fetchComedorPeople(): Promise<ComedorPerson[]> {
  const { data, error } = await supabase.from('comedor_people').select('*').eq('is_active', true).order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function fetchVisits(personId: string): Promise<ComedorVisit[]> {
  const { data, error } = await supabase.from('comedor_visits').select('id, person_id, visit_date').eq('person_id', personId).order('visit_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createComedorPerson(row: Pick<ComedorPerson, 'center_id' | 'nombre'> & Partial<Pick<ComedorPerson, 'apellido' | 'celular' | 'numero_documento'>>): Promise<string> {
  const { data, error } = await supabase.from('comedor_people').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateComedorPerson(id: string, updates: Partial<Pick<ComedorPerson, 'nombre' | 'apellido' | 'celular' | 'numero_documento'>>): Promise<void> {
  const { error } = await supabase.from('comedor_people').update(updates).eq('id', id);
  if (error) throw error;
}

export async function registerVisit(centerId: string, personId: string, visitDate: string): Promise<void> {
  const { error } = await supabase.from('comedor_visits').insert({ center_id: centerId, person_id: personId, visit_date: visitDate });
  if (error) throw error;
}

export async function importComedorRows(rows: Array<Record<string, string>>, centerId: string): Promise<{ ok: number; created: number; skipped: number }> {
  const { data, error } = await supabase.rpc('import_comedor_rows', { p_rows: rows, p_center_id: centerId });
  if (error) throw error;
  return data as { ok: number; created: number; skipped: number };
}
