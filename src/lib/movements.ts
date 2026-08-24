import {
  createMovement as _createMovement,
  updateProduct,
  fetchProduct,
  type MovementKind,
  type ItemType,
} from './db';

export class StockError extends Error {}

export interface MovementInput {
  kind: MovementKind;
  itemType: ItemType;
  itemId: string;
  qty: number;
  fecha: string;
  centerId: string;
  warehouseId: string;
  loteId?: string | null;
  nota?: string;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Registra un movimiento de PRODUCTO. Salidas validadas contra stock disponible.
export async function registerProductMovement(input: MovementInput): Promise<void> {
  const qty = round2(input.qty);
  if (!(qty > 0)) throw new StockError('qty inválida');

  const p = await fetchProduct(input.itemId);
  if (!p) throw new StockError(`producto no existe: ${input.itemId}`);

  const next = input.kind === 'entrada' ? p.total_stock + qty : p.total_stock - qty;
  if (next < 0) {
    throw new StockError(`stock insuficiente para ${p.name}: disponible ${p.total_stock}`);
  }

  await updateProduct(p.id, {
    total_stock: round2(next),
  });

  await _createMovement({
    kind: input.kind,
    item_type: 'product',
    item_id: p.id,
    qty,
    unit_id: p.unit_id,
    lote_id: input.loteId ?? null,
    fecha: input.fecha,
    nota: input.nota ?? '',
    center_id: input.centerId,
    warehouse_id: input.warehouseId,
  });
}
