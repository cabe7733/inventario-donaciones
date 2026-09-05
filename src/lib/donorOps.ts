import { supabase } from './supabase';

// Donantes y beneficiarios comparten estructura; `table` decide la tabla.
export type PartyKind = 'donor' | 'recipient';

export interface Party {
  id: string;
  center_id: string;
  kind: 'person' | 'entity';
  full_name: string;
  id_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TABLE: Record<PartyKind, 'donors' | 'recipients'> = {
  donor: 'donors',
  recipient: 'recipients',
};

export async function fetchParties(kind: PartyKind): Promise<Party[]> {
  const { data, error } = await supabase
    .from(TABLE[kind])
    .select('*')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function createParty(
  kind: PartyKind,
  row: Pick<Party, 'center_id' | 'full_name'> &
    Partial<Pick<Party, 'kind' | 'id_number' | 'phone' | 'email' | 'address' | 'notes'>>,
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLE[kind])
    .insert({ kind: 'person', ...row })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateParty(
  kind: PartyKind,
  id: string,
  updates: Partial<Pick<Party, 'kind' | 'full_name' | 'id_number' | 'phone' | 'email' | 'address' | 'notes' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase.from(TABLE[kind]).update(updates).eq('id', id);
  if (error) throw error;
}

// ponytail: baja lógica; orders referencia donor_id/recipient_id.
export async function deactivateParty(kind: PartyKind, id: string): Promise<void> {
  await updateParty(kind, id, { is_active: false });
}

export async function sendDonationCertificate(donorId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ sent: boolean; error?: string }>('send-donation-certificate', {
    body: { donor_id: donorId },
  });
  if (error) throw error;
  if (!data?.sent) throw new Error(data?.error ?? 'No se pudo enviar el certificado');
}
