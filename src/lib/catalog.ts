import {
  fetchCategories as _fetchCategories,
  fetchUnits as _fetchUnits,
  createCategory as _createCategory,
  createUnit as _createUnit,
  type Scope,
  type Category,
  type Unit,
} from './db';

export type { Category, Unit, Scope };

export const categoriasFor = (cats: Category[], scope: Scope): Category[] =>
  cats.filter((c) => c.scope === scope && c.is_active);

export const unitsFor = (units: Unit[], scope: Scope): Unit[] =>
  units.filter((u) => u.scope === scope && u.is_active);

export async function fetchAllCategories(): Promise<Category[]> {
  return _fetchCategories();
}

export async function fetchAllUnits(): Promise<Unit[]> {
  return _fetchUnits();
}

export async function addCategory(
  name: string,
  scope: Scope,
  iconKey: string,
  order: number,
  color: string,
  centerId: string,
): Promise<string> {
  return _createCategory(name, scope, iconKey, order, color, centerId);
}

export async function addUnit(
  name: string,
  scope: Scope,
  abbreviation: string | undefined,
  centerId: string,
): Promise<string> {
  return _createUnit(name, scope, abbreviation, centerId);
}
