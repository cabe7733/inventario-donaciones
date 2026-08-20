import { db } from './schema';
import { newId, deviceId } from '../lib/ids';
import type { Unit, Category, Scope } from './types';

const SEED_UNITS: Array<Pick<Unit, 'name' | 'abbreviation'> & { scope: Scope[] }> = [
  { name: 'Unidad', abbreviation: 'un', scope: ['product', 'medication'] },
  { name: 'Kilogramo', abbreviation: 'kg', scope: ['product'] },
  { name: 'Gramo', abbreviation: 'g', scope: ['product', 'medication'] },
  { name: 'Litro', abbreviation: 'L', scope: ['product'] },
  { name: 'Mililitro', abbreviation: 'ml', scope: ['product', 'medication'] },
  { name: 'Caja', abbreviation: 'cja', scope: ['product', 'medication'] },
  { name: 'Paquete', abbreviation: 'pqte', scope: ['product', 'medication'] },
  { name: 'Docena', abbreviation: 'doc', scope: ['product'] },
];

const SEED_CATEGORIES: Array<Pick<Category, 'name' | 'color' | 'iconKey' | 'scope'>> = [
  { name: 'Medicamentos', color: 'primary-600', iconKey: 'pills', scope: 'medication' },
];

export async function seedIfEmpty(): Promise<void> {
  const dv = deviceId();

  const unitCount = await db.units.count();
  if (unitCount === 0) {
    await db.units.bulkAdd(
      SEED_UNITS.flatMap<Unit>((u) =>
        u.scope.map((scope) => ({
          id: newId(),
          name: u.name,
          abbreviation: u.abbreviation,
          scope,
          isActive: 1,
          _version: 1,
          _deleted: 0,
          _syncedAt: null,
          _deviceId: dv,
          _clientUuid: newId(),
        })),
      ),
    );
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(
      SEED_CATEGORIES.map<Category>((c, i) => ({
        id: newId(),
        name: c.name,
        color: c.color,
        iconKey: c.iconKey,
        scope: c.scope,
        order: i,
        isActive: 1,
        _version: 1,
        _deleted: 0,
        _syncedAt: null,
        _deviceId: dv,
        _clientUuid: newId(),
      })),
    );
  }
}