import { db } from '../db';
import { deviceId, newId } from './ids';
import type { Category, Scope, Unit } from '../db/types';

// ponytail: scope filtra en memoria; listas <100, sin índice extra necesario
export const categoriasFor = (cats: Category[], scope: Scope): Category[] =>
  cats.filter((c) => c.scope === scope && c.isActive === 1);

export const unitsFor = (units: Unit[], scope: Scope): Unit[] =>
  units.filter((u) => u.scope === scope && u.isActive === 1);

export async function addCategory(name: string, scope: Scope, iconKey: string, order: number, color = 'primary-600'): Promise<string> {
  const id = newId();
  await db.categories.add({
    id,
    name,
    color,
    iconKey,
    scope,
    order,
    isActive: 1,
    _version: 1,
    _deleted: 0,
    _syncedAt: null,
    _deviceId: deviceId(),
    _clientUuid: newId(),
  });
  return id;
}

// ponytail: abreviatura por defecto = 4 letras; se edita después en Más > Unidades
export async function addUnit(name: string, scope: Scope, abbreviation?: string): Promise<string> {
  const id = newId();
  await db.units.add({
    id,
    name,
    scope,
    abbreviation: abbreviation ?? name.toLowerCase().slice(0, 4),
    isActive: 1,
    _version: 1,
    _deleted: 0,
    _syncedAt: null,
    _deviceId: deviceId(),
    _clientUuid: newId(),
  });
  return id;
}