import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Medication,
  MedicationLot,
  Category,
  Unit,
  Movement,
  Kit,
  KitComponent,
  KitBuild,
  KitDelivery,
  SyncQueueRow,
  Operador,
  MetaRow,
  Scope,
} from './types';
import { newId } from '../lib/ids';

export class DonarioDB extends Dexie {
  products!: Table<Product, string>;
  medications!: Table<Medication, string>;
  medicationLots!: Table<MedicationLot, string>;
  categories!: Table<Category, string>;
  units!: Table<Unit, string>;
  movements!: Table<Movement, string>;
  kits!: Table<Kit, string>;
  kitComponents!: Table<KitComponent, string>;
  kitBuilds!: Table<KitBuild, string>;
  kitDeliveries!: Table<KitDelivery, string>;
  syncQueue!: Table<SyncQueueRow, string>;
  operadores!: Table<Operador, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('donario');

    this.version(1).stores({
      products:
        'id, name, categoryId, unitId, isActive, _syncedAt, _deleted, _version, [name+categoryId]',
      medications: 'id, name, categoriaId, unitId, isActive, _syncedAt, _deleted, _version',
      medicationLots: 'id, medicationId, fechaVencimiento, _deleted, _syncedAt',
      categories: 'id, name, order, isActive, _deleted',
      units: 'id, name, abbreviation, isActive, _deleted',
      movements:
        'id, kind, itemType, itemId, fecha, _syncedAt, _deleted, [itemType+itemId], [kind+fecha]',
      kits: 'id, name, categoryId, isActive, _syncedAt, _deleted',
      kitComponents: 'id, kitId, productId, [kitId+order]',
      kitBuilds: 'id, kitId, fecha, _syncedAt, _deleted',
      kitDeliveries: 'id, kitId, fecha, _syncedAt, _deleted',
      syncQueue: 'id, nextRetryAt, createdAt, status',
      operadores: 'id, name, isActive',
      meta: 'key',
    });

    this.version(2)
      .stores({
        categories: 'id, name, scope, order, isActive, _deleted',
        units: 'id, name, scope, abbreviation, isActive, _deleted',
      })
      .upgrade(async (tx) => {
        const cats = (await tx.table('categories').toArray()) as Category[];
        const units = (await tx.table('units').toArray()) as Unit[];
        const meds = (await tx.table('medications').toArray()) as Medication[];
        const prods = (await tx.table('products').toArray()) as Product[];

        const medCatIds = new Set(meds.map((m) => m.categoriaId).filter((v): v is string => !!v));
        const medUnitIds = new Set(meds.map((m) => m.unitId));
        const prodCatIds = new Set(prods.map((p) => p.categoryId).filter((v): v is string => !!v));
        const prodUnitIds = new Set(prods.map((p) => p.unitId));

        const classify = (usedByMed: boolean, usedByProd: boolean): Scope =>
          usedByMed && !usedByProd ? 'medication' : 'product';

        for (const c of cats) {
          const usedByMed = medCatIds.has(c.id);
          const usedByProd = prodCatIds.has(c.id);
          if (usedByMed && usedByProd) {
            const dup: Category = { ...c, id: newId(), scope: 'medication', _syncedAt: null, _clientUuid: newId() };
            await tx.table('categories').add(dup);
            for (const m of meds) {
              if (m.categoriaId === c.id) await tx.table('medications').update(m.id, { categoriaId: dup.id });
            }
            await tx.table('categories').update(c.id, { scope: 'product' });
          } else {
            await tx.table('categories').update(c.id, { scope: classify(usedByMed, usedByProd) });
          }
        }

        for (const u of units) {
          const usedByMed = medUnitIds.has(u.id);
          const usedByProd = prodUnitIds.has(u.id);
          if (usedByMed && usedByProd) {
            const dup: Unit = { ...u, id: newId(), scope: 'medication', _syncedAt: null, _clientUuid: newId() };
            await tx.table('units').add(dup);
            for (const m of meds) {
              if (m.unitId === u.id) await tx.table('medications').update(m.id, { unitId: dup.id });
            }
            await tx.table('units').update(u.id, { scope: 'product' });
          } else {
            await tx.table('units').update(u.id, { scope: classify(usedByMed, usedByProd) });
          }
        }
      });
  }
}

export const db = new DonarioDB();
