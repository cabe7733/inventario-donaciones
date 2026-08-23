import {
  fetchKit,
  fetchKitComponents,
  fetchProduct,
  updateProduct,
  updateKit,
  createMovement,
  createKitBuild,
  createKitDelivery,
} from './db';
import { nowISO } from './ids';
import { round2, StockError } from './movements';

// Máximo de kits ensamblables sin que el producto quede en 0.
export function maxBuildable(stock: number, qtyPerKit: number): number {
  if (qtyPerKit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil(stock / qtyPerKit) - 1);
}

// Ensambla `qty` kits: descuenta componentes, suma stock del kit.
export async function buildKit(kitId: string, qty: number, centerId: string): Promise<void> {
  if (!(qty > 0)) throw new StockError('qty inválida');
  const fecha = nowISO();

  const kit = await fetchKit(kitId);
  if (!kit) throw new StockError('kit no existe');
  const comps = await fetchKitComponents(kitId);
  if (comps.length === 0) throw new StockError('el kit no tiene componentes');

  // Valida todo antes de descontar: si falta stock no se toca ningún producto.
  const plan: Array<{ p: NonNullable<Awaited<ReturnType<typeof fetchProduct>>>; need: number }> = [];
  for (const c of comps) {
    const p = await fetchProduct(c.product_id);
    const need = round2(c.qty * qty);
    if (!p || p.total_stock - need <= 0) {
      throw new StockError(
        `No se puede ensamblar ${qty} × ${kit.name}: ${p?.name ?? '?'} quedaría en 0. Con el stock actual podés ensamblar hasta ${maxBuildable(p?.total_stock ?? 0, c.qty)}.`,
      );
    }
    plan.push({ p, need });
  }

  for (const { p, need } of plan) {
    await updateProduct(p.id, {
      total_stock: round2(p.total_stock - need),
    });
    await createMovement({
      kind: 'salida',
      item_type: 'product',
      item_id: p.id,
      qty: need,
      unit_id: p.unit_id,
      lote_id: null,
      fecha,
      nota: `Ensamblado en kit "${kit.name}" (${qty})`,
      center_id: centerId,
    });
  }

  await updateKit(kit.id, {
    total_stock: round2(kit.total_stock + qty),
  });

  await createKitBuild(kit.id, qty, fecha, centerId);

  await createMovement({
    kind: 'entrada',
    item_type: 'kit',
    item_id: kit.id,
    qty,
    unit_id: kit.unit_id,
    lote_id: null,
    fecha,
    nota: '',
    center_id: centerId,
  });
}

// Entrega `qty` kits.
export async function deliverKit(kitId: string, qty: number, centerId: string): Promise<void> {
  if (!(qty > 0)) throw new StockError('qty inválida');
  const fecha = nowISO();

  const kit = await fetchKit(kitId);
  if (!kit) throw new StockError('kit no existe');
  const next = round2(kit.total_stock - qty);
  if (next < 0) {
    throw new StockError(
      `Stock insuficiente de kit ${kit.name}: disponible ${kit.total_stock}`,
    );
  }

  await updateKit(kit.id, {
    total_stock: next,
  });

  await createKitDelivery(kit.id, qty, fecha, centerId);

  await createMovement({
    kind: 'salida',
    item_type: 'kit',
    item_id: kit.id,
    qty,
    unit_id: kit.unit_id,
    lote_id: null,
    fecha,
    nota: '',
    center_id: centerId,
  });
}
