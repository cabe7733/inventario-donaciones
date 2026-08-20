// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { nowISO } from './ids';
import { addLot, fefoPlan, salidaFefo } from './medicationOps';
import { StockError } from './movements';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedMedication(id = 'med-1', unitId = 'u1'): Promise<void> {
  await db.units.add({
    id: unitId,
    name: 'Comprimido',
    abbreviation: 'comp',
    scope: 'medication',
    isActive: 1,
    _version: 1,
    _deleted: 0,
    _syncedAt: null,
    _deviceId: 't',
    _clientUuid: 't',
  });
  await db.medications.add({
    id,
    name: 'Amoxicilina',
    presentacion: '',
    categoriaId: null,
    unitId,
    isActive: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    _version: 1,
    _deleted: 0,
    _syncedAt: null,
    _deviceId: 't',
    _clientUuid: 't',
  });
}

describe('FEFO', () => {
  it('consume primero el lote que vence antes (los sin vencimiento al final)', async () => {
    await seedMedication();
    const t = 'T00:00:00';
    await addLot({ medicationId: 'med-1', lote: 'L1', fechaVencimiento: '2026-01-01', stockIn: 2, fecha: `2026-01-01${t}` });
    await addLot({ medicationId: 'med-1', lote: 'L2', fechaVencimiento: '2026-12-01', stockIn: 2, fecha: `2026-01-02${t}` });
    await addLot({ medicationId: 'med-1', lote: 'L3', fechaVencimiento: null, stockIn: 2, fecha: `2026-01-03${t}` });

    const plan = await fefoPlan('med-1', 5);
    expect(plan.map((s) => s.lote)).toEqual(['L1', 'L2', 'L3']);
    expect(plan.map((s) => s.qty)).toEqual([2, 2, 1]);
  });

  it('salidaFefo descuenta stock por lote y bloquea stock insuficiente', async () => {
    await seedMedication();
    const t = 'T00:00:00';
    await addLot({ medicationId: 'med-1', lote: 'L1', fechaVencimiento: '2026-01-01', stockIn: 3, fecha: `2026-01-01${t}` });
    await addLot({ medicationId: 'med-1', lote: 'L2', fechaVencimiento: '2026-03-01', stockIn: 1, fecha: `2026-01-02${t}` });

    const consumed = await salidaFefo({ medicationId: 'med-1', qty: 3, fecha: `2026-02-01${t}` });
    expect(consumed.map((c) => `${c.lote}:${c.qty}`)).toEqual(['L1:3']);

    const lots = await db.medicationLots.toArray();
    const by = Object.fromEntries(lots.map((l) => [l.lote, l.stock]));
    expect(by.L1).toBe(0);
    expect(by.L2).toBe(1);

    await expect(salidaFefo({ medicationId: 'med-1', qty: 2, fecha: `2026-02-01${t}` })).rejects.toThrow(
      StockError,
    );
  });
});