import { supabase } from './supabase';

export type PrescriptionStatus = 'draft' | 'dispensed' | 'cancelled';
export type PrescriptionPatientType = 'person' | 'health_center';
export type PrescriptionItemType = 'medication' | 'medical_supply';

export interface ExitAuthorizer {
  id: string;
  center_id: string;
  name: string;
  document_number: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationExitAuthorizer {
  id: string;
  center_id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: { full_name: string; email: string | null } | null;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  item_type: PrescriptionItemType;
  item_id: string;
  lote_id: string | null;
  qty: number;
  unit_id: string | null;
  instructions: string;
  notes: string;
  medication_snapshot: Record<string, string | null> | null;
  created_at: string;
}

export interface MedicalPrescription {
  id: string;
  center_id: string;
  warehouse_id: string | null;
  patient_type: PrescriptionPatientType;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_document_number: string | null;
  patient_birth_date: string | null;
  patient_sex: string | null;
  patient_phone: string | null;
  health_center_name: string | null;
  health_center_document: string | null;
  health_center_contact: string | null;
  health_center_phone: string | null;
  health_center_address: string | null;
  doctor_user_id: string | null;
  created_by: string;
  inventory_authorizer_id: string | null;
  medication_authorizer_user_id: string | null;
  dispensed_by: string | null;
  status: PrescriptionStatus;
  notes: string;
  created_at: string;
  dispensed_at: string | null;
  updated_at: string;
  medical_prescription_items?: PrescriptionItem[];
}

export interface PrescriptionInput {
  warehouse_id?: string | null;
  patient_type: PrescriptionPatientType;
  doctor_user_id?: string | null;
  inventory_authorizer_id?: string | null;
  medication_authorizer_user_id?: string | null;
  patient_first_name?: string | null;
  patient_last_name?: string | null;
  patient_document_number?: string | null;
  patient_birth_date?: string | null;
  patient_sex?: string | null;
  patient_phone?: string | null;
  health_center_name?: string | null;
  health_center_document?: string | null;
  health_center_contact?: string | null;
  health_center_phone?: string | null;
  health_center_address?: string | null;
  notes?: string;
}

export interface PrescriptionItemInput {
  item_type: PrescriptionItemType;
  item_id: string;
  qty: number;
  unit_id?: string | null;
  instructions?: string;
  notes?: string;
}

export async function fetchPrescriptions(): Promise<MedicalPrescription[]> {
  const { data, error } = await supabase
    .from('medical_prescriptions')
    .select('*, medical_prescription_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MedicalPrescription[];
}

export async function fetchPrescription(id: string): Promise<MedicalPrescription> {
  const { data, error } = await supabase
    .from('medical_prescriptions')
    .select('*, medical_prescription_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as MedicalPrescription;
}

export async function createPrescription(input: PrescriptionInput, items: PrescriptionItemInput[]): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data: membership, error: membershipError } = await supabase
    .from('center_members')
    .select('center_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();
  if (membershipError || !membership) throw new Error('No hay centro activo');
  const { data: prescription, error } = await supabase
    .from('medical_prescriptions')
    .insert({ ...input, center_id: membership.center_id, created_by: user.id, status: 'draft', notes: input.notes ?? '' })
    .select('id')
    .single();
  if (error) throw error;
  const { error: itemsError } = await supabase.from('medical_prescription_items').insert(
    items.map((item) => ({ ...item, prescription_id: prescription.id, instructions: item.instructions ?? '', notes: item.notes ?? '' })),
  );
  if (itemsError) {
    await supabase.from('medical_prescriptions').delete().eq('id', prescription.id);
    throw itemsError;
  }
  return prescription.id;
}

export async function updatePrescription(id: string, input: PrescriptionInput, items: PrescriptionItemInput[]): Promise<void> {
  const { error } = await supabase.from('medical_prescriptions').update({ ...input, notes: input.notes ?? '' }).eq('id', id).eq('status', 'draft');
  if (error) throw error;
  const { error: deleteError } = await supabase.from('medical_prescription_items').delete().eq('prescription_id', id);
  if (deleteError) throw deleteError;
  const { error: itemsError } = await supabase.from('medical_prescription_items').insert(
    items.map((item) => ({ ...item, prescription_id: id, instructions: item.instructions ?? '', notes: item.notes ?? '' })),
  );
  if (itemsError) throw itemsError;
}

export async function dispatchPrescription(id: string): Promise<void> {
  const { error } = await supabase.rpc('dispatch_medical_prescription_v2', { p_prescription_id: id });
  if (error) throw error;
}

export async function fetchInventoryAuthorizers(): Promise<ExitAuthorizer[]> {
  const { data, error } = await supabase.from('inventory_exit_authorizers').select('*').eq('is_active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function saveInventoryAuthorizer(input: Pick<ExitAuthorizer, 'name' | 'document_number' | 'role'>, id?: string): Promise<void> {
  const query = id
    ? supabase.from('inventory_exit_authorizers').update(input).eq('id', id)
    : supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) throw new Error('No autenticado');
      const { data: member, error: memberError } = await supabase
        .from('center_members')
        .select('center_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      if (memberError || !member) throw new Error('No hay centro activo');
      return supabase.from('inventory_exit_authorizers').insert({ ...input, center_id: member.center_id });
    });
  const { error } = await query;
  if (error) throw error;
}

export async function deactivateInventoryAuthorizer(id: string): Promise<void> {
  const { error } = await supabase.from('inventory_exit_authorizers').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function fetchMedicationAuthorizers(): Promise<MedicationExitAuthorizer[]> {
  const { data, error } = await supabase.from('medication_exit_authorizers').select('*').eq('is_active', true).order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function saveMedicationAuthorizer(userId: string, id?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data: member } = await supabase.from('center_members').select('center_id').eq('user_id', user.id).eq('is_active', true).single();
  if (!member) throw new Error('No hay centro activo');
  const query = id
    ? supabase.from('medication_exit_authorizers').update({ user_id: userId }).eq('id', id)
    : supabase.from('medication_exit_authorizers').insert({ center_id: member.center_id, user_id: userId, is_active: true });
  const { error } = await query;
  if (error) throw error;
}

export async function deactivateMedicationAuthorizer(id: string): Promise<void> {
  const { error } = await supabase.from('medication_exit_authorizers').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function fetchCenterMembers(): Promise<Array<{ user_id: string; full_name: string; email: string | null }>> {
  const { data, error } = await supabase.rpc('get_center_member_profiles');
  if (error) throw error;
  return data ?? [];
}
