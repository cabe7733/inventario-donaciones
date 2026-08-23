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
  nota?: string;
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

  await createMovement({
    kind: 'entrada',
    item_type: 'medication',
    item_id: args.medicationId,
    qty,
    unit_id: med.unit_id,
    lote_id: lot.id,
    fecha: args.fecha,
    nota: args.nota ?? `Lote ${lot.lote}`,
    center_id: args.centerId,
  });
}

// Salida FEFO: consume lotes por vencimiento.
export async function salidaFefo(args: {
  medicationId: string;
  qty: number;
  fecha: string;
  centerId: string;
  nota?: string;
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
      nota: args.nota ?? `Lote ${p.lote}`,
      center_id: args.centerId,
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
