import { supabase } from './supabase';
import {
  fetchMedication,
  fetchLots as _fetchLots,
  fetchLot,
  createLot as _createLot,
  updateLot,
  createMovement,
  type MedicationLot,
} from './db';
import { newId } from './ids';
import { round2, StockError } from './movements';

function lotSortKey(l: MedicationLot): string {
  return `${l.fecha_vencimiento ?? '9999-99-99'}|${l.created_at}|${l.id}`;
}

export async function lotsFor(medicationId: string): Promise<MedicationLot[]> {
  const all = await _fetchLots(medicationId);
  return all.sort((a, b) => (lotSortKey(a) < lotSortKey(b) ? -1 : 1));
}

export function stockFor(lots: MedicationLot[]): number {
  return round2(lots.reduce((acc, l) => acc + l.stock, 0));
}

// Crea un lote nuevo y registra su stock inicial como entrada.
export async function addLot(args: {
  medicationId: string;
  lote: string;
  fechaVencimiento: string | null;
  stockIn: number;
  fecha: string;
  centerId: string;
  warehouseId?: string | null;
  nota?: string;
}): Promise<string> {
  const med = await fetchMedication(args.medicationId);
  if (!med) throw new StockError('medicamento no existe');

  const id = newId();
  await _createLot({
    id,
    medication_id: args.medicationId,
    lote: args.lote.trim() || 's/n',
    fecha_vencimiento: args.fechaVencimiento,
    stock: round2(args.stockIn),
    center_id: args.centerId,
  });

  await createMovement({
    kind: 'entrada',
    item_type: 'medication',
    item_id: args.medicationId,
    qty: round2(args.stockIn),
    unit_id: med.unit_id,
    lote_id: id,
    fecha: args.fecha,
    nota: args.nota ?? `Lote ${args.lote}`,
    center_id: args.centerId,
    warehouse_id: args.warehouseId ?? null,
  });

  return id;
}

// Entrada a un lote existente.
export async function registerMedicationEntrada(args: {
  medicationId: string;
  loteId: string;
  qty: number;
  fecha: string;
  centerId: string;
  warehouseId?: string | null;
  nota?: string;
  donorId?: string | null;
  donorName?: string | null;
}): Promise<void> {
  const qty = round2(args.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');

  const med = await fetchMedication(args.medicationId);
  const lot = await fetchLot(args.loteId);
  if (!med) throw new StockError('medicamento no existe');
  if (!lot || lot.medication_id !== args.medicationId) throw new StockError('lote no existe');

  await updateLot(lot.id, {
    stock: round2(lot.stock + qty),
  });

  const nota = args.nota
    || (args.donorName ? `Donante: ${args.donorName}` : `Lote ${lot.lote}`);

  await createMovement({
    kind: 'entrada',
    item_type: 'medication',
    item_id: args.medicationId,
    qty,
    unit_id: med.unit_id,
    lote_id: lot.id,
    fecha: args.fecha,
    nota,
    center_id: args.centerId,
    warehouse_id: args.warehouseId ?? null,
    donor_id: args.donorId ?? null,
  });
}

// Salida FEFO: consume lotes por vencimiento.
export async function salidaFefo(args: {
  medicationId: string;
  qty: number;
  fecha: string;
  centerId: string;
  warehouseId?: string | null;
  nota?: string;
  recipientId?: string | null;
  recipientName?: string | null;
}): Promise<Array<{ loteId: string; lote: string; qty: number }>> {
  const qty = round2(args.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');

  const med = await fetchMedication(args.medicationId);
  if (!med) throw new StockError('medicamento no existe');

  const lots = (await lotsFor(args.medicationId)).filter((l) => l.stock > 0);
  const total = round2(lots.reduce((acc, l) => acc + l.stock, 0));
  if (total < qty) {
    throw new StockError(`Stock insuficiente de ${med.name}: disponible ${total}`);
  }

  const plan: Array<{ loteId: string; lote: string; qty: number }> = [];
  let remaining = qty;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.stock, remaining);
    plan.push({ loteId: lot.id, lote: lot.lote, qty: round2(take) });
    remaining = round2(remaining - take);
  }

  const baseNota = args.nota
    || (args.recipientName ? `Beneficiario: ${args.recipientName}` : '');

  for (const p of plan) {
    const lot = lots.find((l) => l.id === p.loteId)!;
    await updateLot(lot.id, {
      stock: round2(lot.stock - p.qty),
    });
    await createMovement({
      kind: 'salida',
      item_type: 'medication',
      item_id: args.medicationId,
      qty: p.qty,
      unit_id: med.unit_id,
      lote_id: p.loteId,
      fecha: args.fecha,
      nota: baseNota || `Lote ${p.lote}`,
      center_id: args.centerId,
      warehouse_id: args.warehouseId ?? null,
      recipient_id: args.recipientId ?? null,
    });
  }
  return plan;
}

// Simula FEFO sin escribir.
export async function fefoPlan(
  medicationId: string,
  qty: number,
): Promise<Array<{ loteId: string; lote: string; vencimiento: string | null; qty: number }>> {
  const lots = (await lotsFor(medicationId)).filter((l) => l.stock > 0);
  let remaining = round2(qty);
  const out: Array<{ loteId: string; lote: string; vencimiento: string | null; qty: number }> = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.stock, remaining);
    out.push({ loteId: lot.id, lote: lot.lote, vencimiento: lot.fecha_vencimiento, qty: round2(take) });
    remaining = round2(remaining - take);
  }
  return out;
}

export function lotExpiresSoon(lot: MedicationLot, days = 90): boolean {
  if (!lot.fecha_vencimiento || lot.stock <= 0) return false;
  const exp = new Date(`${lot.fecha_vencimiento}T23:59:59`);
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return exp <= limit;
}

export function lotExpired(lot: MedicationLot): boolean {
  if (!lot.fecha_vencimiento || lot.stock <= 0) return false;
  return new Date(`${lot.fecha_vencimiento}T23:59:59`) < new Date();
}

/**
 * Elimina un movimiento de medicamento y revierte el stock del lote correspondiente.
 */
export async function deleteMedicationMovement(movementId: string): Promise<void> {
  const { data: mov, error: fetchErr } = await supabase
    .from('movements')
    .select('*')
    .eq('id', movementId)
    .single();

  if (fetchErr || !mov) throw new Error('Movimiento no encontrado');
  if (mov.deleted) return;

  if (mov.lote_id) {
    const lot = await fetchLot(mov.lote_id);
    if (lot) {
      if (mov.kind === 'entrada') {
        // Al borrar una entrada, restamos la cantidad del stock del lote
        const newStock = Math.max(0, round2(lot.stock - mov.qty));
        await updateLot(lot.id, { stock: newStock });
      } else if (mov.kind === 'salida') {
        // Al borrar una salida, devolvemos la cantidad al stock del lote
        const newStock = round2(lot.stock + mov.qty);
        await updateLot(lot.id, { stock: newStock });
      }
    }
  }

  const { error: deleteErr } = await supabase
    .from('movements')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', movementId);

  if (deleteErr) throw deleteErr;
}

/**
 * Edita los datos de un movimiento de medicamento y recalibra el stock si cambió la cantidad.
 */
export async function updateMedicationMovement(args: {
  id: string;
  qty?: number;
  fecha?: string;
  nota?: string;
  loteCode?: string;
  fechaVencimiento?: string | null;
  donorId?: string | null;
  recipientId?: string | null;
}): Promise<void> {
  const { data: mov, error: fetchErr } = await supabase
    .from('movements')
    .select('*')
    .eq('id', args.id)
    .single();

  if (fetchErr || !mov) throw new Error('Movimiento no encontrado');

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (args.fecha !== undefined) updates.fecha = args.fecha;
  if (args.nota !== undefined) updates.nota = args.nota;
  if (args.donorId !== undefined) updates.donor_id = args.donorId;
  if (args.recipientId !== undefined) updates.recipient_id = args.recipientId;

  // Actualización del lote (código de lote, fecha de vencimiento y stock)
  if (mov.lote_id) {
    const lot = await fetchLot(mov.lote_id);
    if (lot) {
      const lotUpdates: Record<string, unknown> = {};
      if (args.loteCode !== undefined && args.loteCode.trim() !== '') {
        lotUpdates.lote = args.loteCode.trim();
      }
      if (args.fechaVencimiento !== undefined) {
        lotUpdates.fecha_vencimiento = args.fechaVencimiento || null;
      }

      if (args.qty !== undefined && args.qty !== mov.qty) {
        const newQty = round2(args.qty);
        if (!(newQty > 0)) throw new StockError('Cantidad inválida');
        const diff = round2(newQty - mov.qty);
        if (mov.kind === 'entrada') {
          lotUpdates.stock = Math.max(0, round2(lot.stock + diff));
        } else if (mov.kind === 'salida') {
          lotUpdates.stock = Math.max(0, round2(lot.stock - diff));
        }
        updates.qty = newQty;
      }

      if (Object.keys(lotUpdates).length > 0) {
        await updateLot(lot.id, lotUpdates);
      }
    }
  }

  const { error: updateErr } = await supabase
    .from('movements')
    .update(updates)
    .eq('id', args.id);

  if (updateErr) throw updateErr;
}
