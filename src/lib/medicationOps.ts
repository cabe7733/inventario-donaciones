import { db } from '../db';
import { deviceId, newId, nowISO } from './ids';
import { addMovement, round2, StockError } from './movements';
import type { MedicationLot } from '../db/types';

function lotSortKey(l: MedicationLot): string {
  // vencimiento nulls van al final; si no hay vencimiento, se consume último
  return `${l.fechaVencimiento ?? '9999-99-99'}|${l.createdAt}|${l.id}`;
}

export async function lotsFor(medicationId: string): Promise<MedicationLot[]> {
  const all = await db.medicationLots.where('medicationId').equals(medicationId).toArray();
  return all
    .filter((l) => l._deleted === 0)
    .sort((a, b) => (lotSortKey(a) < lotSortKey(b) ? -1 : 1));
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
  nota?: string;
}): Promise<string> {
  const id = newId();
  const fecha = args.fecha;
  await db.transaction('rw', db.medicationLots, db.movements, db.medications, async () => {
    const med = await db.medications.get(args.medicationId);
    if (!med) throw new StockError('medicamento no existe');
    await db.medicationLots.add({
      id,
      medicationId: args.medicationId,
      lote: args.lote.trim() || 's/n',
      fechaVencimiento: args.fechaVencimiento,
      stock: round2(args.stockIn),
      createdAt: nowISO(),
      _version: 1,
      _deleted: 0,
      _syncedAt: null,
      _deviceId: deviceId(),
      _clientUuid: newId(),
    });
    await addMovement({
      kind: 'entrada',
      itemType: 'medication',
      itemId: args.medicationId,
      qty: round2(args.stockIn),
      unitId: med.unitId,
      loteId: id,
      fecha,
      nota: args.nota ?? `Lote ${args.lote}`,
    });
  });
  return id;
}

// Entrada a un lote existente.
export async function registerMedicationEntrada(args: {
  medicationId: string;
  loteId: string;
  qty: number;
  fecha: string;
  nota?: string;
}): Promise<void> {
  const qty = round2(args.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');
  await db.transaction('rw', db.medicationLots, db.movements, db.medications, async () => {
    const med = await db.medications.get(args.medicationId);
    const lot = await db.medicationLots.get(args.loteId);
    if (!med) throw new StockError('medicamento no existe');
    if (!lot || lot.medicationId !== args.medicationId) throw new StockError('lote no existe');
    await db.medicationLots.update(lot.id, {
      stock: round2(lot.stock + qty),
      _version: lot._version + 1,
      _syncedAt: null,
    });
    await addMovement({
      kind: 'entrada',
      itemType: 'medication',
      itemId: args.medicationId,
      qty,
      unitId: med.unitId,
      loteId: lot.id,
      fecha: args.fecha,
      nota: args.nota ?? `Lote ${lot.lote}`,
    });
  });
}

// Salida FEFO: consume lotes por vencimiento (el que vence primero sale primero).
// Devuelve el plan de consumo para mostrarlo en la UI.
export async function salidaFefo(args: {
  medicationId: string;
  qty: number;
  fecha: string;
  nota?: string;
}): Promise<Array<{ loteId: string; lote: string; qty: number }>> {
  const qty = round2(args.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');

  return db.transaction('rw', db.medicationLots, db.movements, db.medications, async () => {
    const med = await db.medications.get(args.medicationId);
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
      await db.medicationLots.update(lot.id, {
        stock: round2(lot.stock - p.qty),
        _version: lot._version + 1,
        _syncedAt: null,
      });
      await addMovement({
        kind: 'salida',
        itemType: 'medication',
        itemId: args.medicationId,
        qty: p.qty,
        unitId: med.unitId,
        loteId: p.loteId,
        fecha: args.fecha,
        nota: args.nota ?? `Lote ${p.lote}`,
      });
    }
    return plan;
  });
}

// Simula FEFO sin escribir, para mostrar el plan antes de confirmar.
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
    out.push({ loteId: lot.id, lote: lot.lote, vencimiento: lot.fechaVencimiento, qty: round2(take) });
    remaining = round2(remaining - take);
  }
  return out;
}

export function lotExpiresSoon(lot: MedicationLot, days = 90): boolean {
  if (!lot.fechaVencimiento || lot.stock <= 0) return false;
  const exp = new Date(`${lot.fechaVencimiento}T23:59:59`);
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return exp <= limit;
}

export function lotExpired(lot: MedicationLot): boolean {
  if (!lot.fechaVencimiento || lot.stock <= 0) return false;
  return new Date(`${lot.fechaVencimiento}T23:59:59`) < new Date();
}