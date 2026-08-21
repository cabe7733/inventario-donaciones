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

// Ensambla `qty` kits: descuenta componentes, suma stock del kit.
export async function buildKit(kitId: string, qty: number): Promise<void> {
  if (!(qty > 0)) throw new StockError('qty inválida');
  const fecha = nowISO();

  const kit = await fetchKit(kitId);
  if (!kit) throw new StockError('kit no existe');
  const comps = await fetchKitComponents(kitId);
  if (comps.length === 0) throw new StockError('el kit no tiene componentes');

  for (const c of comps) {
    const p = await fetchProduct(c.product_id);
    const need = round2(c.qty * qty);
    if (!p || p.total_stock < need) {
      throw new StockError(
        `Falta ${p?.name ?? '?'} para ensamblar ${qty} × ${kit.name}: requiere ${need}`,
      );
    }
    await updateProduct(p.id, {
      total_stock: round2(p.total_stock - need),
      version: p.version + 1,
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
    });
  }

  await updateKit(kit.id, {
    total_stock: round2(kit.total_stock + qty),
    version: kit.version + 1,
  });

  await createKitBuild(kit.id, qty, fecha);

  await createMovement({
    kind: 'entrada',
    item_type: 'kit',
    item_id: kit.id,
    qty,
    unit_id: kit.unit_id,
    lote_id: null,
    fecha,
    nota: '',
  });
}

// Entrega `qty` kits.
export async function deliverKit(kitId: string, qty: number): Promise<void> {
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
    version: kit.version + 1,
  });

  await createKitDelivery(kit.id, qty, fecha);

  await createMovement({
    kind: 'salida',
    item_type: 'kit',
    item_id: kit.id,
    qty,
    unit_id: kit.unit_id,
    lote_id: null,
    fecha,
    nota: '',
  });
}
