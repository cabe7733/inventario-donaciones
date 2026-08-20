import { db } from '../db';
import { deviceId, newId, nowISO } from './ids';
import type { ItemType, MovementKind } from '../db/types';

export class StockError extends Error {}

export interface MovementInput {
  kind: MovementKind;
  itemType: ItemType;
  itemId: string;
  qty: number;
  fecha: string;
  loteId?: string | null;
  nota?: string;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function addMovement(row: {
  kind: MovementKind;
  itemType: ItemType;
  itemId: string;
  qty: number;
  unitId: string;
  loteId: string | null;
  fecha: string;
  nota: string;
}): Promise<void> {
  await db.movements.add({
    id: newId(),
    kind: row.kind,
    itemType: row.itemType,
    itemId: row.itemId,
    qty: row.qty,
    unitId: row.unitId,
    loteId: row.loteId,
    fecha: row.fecha,
    operadorId: null,
    nota: row.nota,
    createdAt: nowISO(),
    _version: 1,
    _deleted: 0,
    _syncedAt: null,
    _deviceId: deviceId(),
    _clientUuid: newId(),
  });
}

// Registra un movimiento de PRODUCTO en una sola transacción. Salidas validadas
// contra el stock disponible (bloquea stock negativo).
export async function registerProductMovement(input: MovementInput): Promise<void> {
  const qty = round2(input.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');

  await db.transaction('rw', db.products, db.movements, async () => {
    const p = await db.products.get(input.itemId);
    if (!p) throw new StockError(`producto no existe: ${input.itemId}`);

    const next = input.kind === 'entrada' ? p.totalStock + qty : p.totalStock - qty;
    if (next < 0) {
      throw new StockError(`stock insuficiente para ${p.name}: disponible ${p.totalStock}`);
    }

    await db.products.update(p.id, {
      totalStock: round2(next),
      _version: p._version + 1,
      _syncedAt: null,
      updatedAt: nowISO(),
    });

    await addMovement({
      kind: input.kind,
      itemType: 'product',
      itemId: p.id,
      qty,
      unitId: p.unitId,
      loteId: input.loteId ?? null,
      fecha: input.fecha,
      nota: input.nota ?? '',
    });
  });
}