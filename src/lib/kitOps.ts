import { db } from '../db';
import { deviceId, newId, nowISO } from './ids';
import { addMovement, StockError, round2 } from './movements';

// Ensambla `qty` kits: descuenta componentes (producto por producto), suma stock
// del kit y registra la trazabilidad en movements + kit_builds.
export async function buildKit(kitId: string, qty: number): Promise<void> {
  if (!(qty > 0)) throw new StockError('qty inválida');
  const fecha = nowISO();

  await db.transaction(
    'rw',
    db.kits,
    db.kitComponents,
    db.products,
    db.kitBuilds,
    db.movements,
    async () => {
      const kit = await db.kits.get(kitId);
      if (!kit) throw new StockError('kit no existe');
      const comps = await db.kitComponents.where('kitId').equals(kitId).toArray();
      if (comps.length === 0) throw new StockError('el kit no tiene componentes');

      for (const c of comps) {
        const p = await db.products.get(c.productId);
        const need = round2(c.qty * qty);
        if (!p || p.totalStock < need) {
          throw new StockError(
            `Falta ${p?.name ?? '?'} para ensamblar ${qty} × ${kit.name}: requiere ${need}`,
          );
        }
        await db.products.update(p.id, {
          totalStock: round2(p.totalStock - need),
          _version: p._version + 1,
          _syncedAt: null,
          updatedAt: nowISO(),
        });
        await addMovement({
          kind: 'salida',
          itemType: 'product',
          itemId: p.id,
          qty: need,
          unitId: p.unitId,
          loteId: null,
          fecha,
          nota: `Ensamblado en kit “${kit.name}” (${qty})`,
        });
      }

      await db.kits.update(kit.id, {
        totalStock: round2(kit.totalStock + qty),
        _version: kit._version + 1,
        _syncedAt: null,
        updatedAt: nowISO(),
      });

      await db.kitBuilds.add({
        id: newId(),
        kitId: kit.id,
        qty,
        fecha,
        operadorId: null,
        nota: '',
        createdAt: nowISO(),
        _version: 1,
        _deleted: 0,
        _syncedAt: null,
        _deviceId: deviceId(),
        _clientUuid: newId(),
      });

      await addMovement({
        kind: 'entrada',
        itemType: 'kit',
        itemId: kit.id,
        qty,
        unitId: kit.unitId,
        loteId: null,
        fecha,
        nota: '',
      });
    },
  );
}

// Entrega `qty` kits: valida stock del kit.
export async function deliverKit(kitId: string, qty: number): Promise<void> {
  if (!(qty > 0)) throw new StockError('qty inválida');
  const fecha = nowISO();

  await db.transaction('rw', db.kits, db.kitDeliveries, db.movements, async () => {
    const kit = await db.kits.get(kitId);
    if (!kit) throw new StockError('kit no existe');
    const next = round2(kit.totalStock - qty);
    if (next < 0) {
      throw new StockError(
        `Stock insuficiente de kit ${kit.name}: disponible ${kit.totalStock}`,
      );
    }

    await db.kits.update(kit.id, {
      totalStock: next,
      _version: kit._version + 1,
      _syncedAt: null,
      updatedAt: nowISO(),
    });

    await db.kitDeliveries.add({
      id: newId(),
      kitId: kit.id,
      qty,
      fecha,
      operadorId: null,
      nota: '',
      createdAt: nowISO(),
      _version: 1,
      _deleted: 0,
      _syncedAt: null,
      _deviceId: deviceId(),
      _clientUuid: newId(),
    });

    await addMovement({
      kind: 'salida',
      itemType: 'kit',
      itemId: kit.id,
      qty,
      unitId: kit.unitId,
      loteId: null,
      fecha,
      nota: '',
    });
  });
}