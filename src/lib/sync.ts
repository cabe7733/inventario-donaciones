import type { Table } from 'dexie';
import { db } from '../db';
import { supabase, syncEnabled } from './supabase';
import { nowISO } from './ids';

// Config por tabla: nombre SQL + pares [campo Dexie, campo SQL].
// El meta de sync (_version→version, _deleted→deleted, _deviceId→device_id,
// _clientUuid→client_uuid, createdAt→created_at, updatedAt→updated_at) se
// maneja genéricamente abajo.

interface SyncTableConfig {
  dexie: Table;
  sql: string;
  fields: Array<[string, string]>;
}

const TABLES: SyncTableConfig[] = [
  {
    dexie: db.categories,
    sql: 'categories',
    fields: [
      ['name', 'name'],
      ['color', 'color'],
      ['iconKey', 'icon_key'],
      ['order', 'order'],
      ['scope', 'scope'],
      ['isActive', 'is_active'],
    ],
  },
  {
    dexie: db.units,
    sql: 'units',
    fields: [
      ['name', 'name'],
      ['abbreviation', 'abbreviation'],
      ['scope', 'scope'],
      ['isActive', 'is_active'],
    ],
  },
  {
    dexie: db.products,
    sql: 'products',
    fields: [
      ['name', 'name'],
      ['aliases', 'aliases'],
      ['categoryId', 'category_id'],
      ['unitId', 'unit_id'],
      ['minStock', 'min_stock'],
      ['totalStock', 'total_stock'],
      ['isActive', 'is_active'],
    ],
  },
  {
    dexie: db.medications,
    sql: 'medications',
    fields: [
      ['name', 'name'],
      ['presentacion', 'presentacion'],
      ['categoriaId', 'categoria_id'],
      ['unitId', 'unit_id'],
      ['isActive', 'is_active'],
    ],
  },
  {
    dexie: db.medicationLots,
    sql: 'medication_lots',
    fields: [
      ['medicationId', 'medication_id'],
      ['lote', 'lote'],
      ['fechaVencimiento', 'fecha_vencimiento'],
      ['stock', 'stock'],
    ],
  },
  {
    dexie: db.movements,
    sql: 'movements',
    fields: [
      ['kind', 'kind'],
      ['itemType', 'item_type'],
      ['itemId', 'item_id'],
      ['qty', 'qty'],
      ['unitId', 'unit_id'],
      ['loteId', 'lote_id'],
      ['fecha', 'fecha'],
      ['operadorId', 'operador_id'],
      ['nota', 'nota'],
    ],
  },
  {
    dexie: db.kits,
    sql: 'kits',
    fields: [
      ['name', 'name'],
      ['categoryId', 'category_id'],
      ['unitId', 'unit_id'],
      ['totalStock', 'total_stock'],
      ['isActive', 'is_active'],
    ],
  },
  {
    dexie: db.kitBuilds,
    sql: 'kit_builds',
    fields: [
      ['kitId', 'kit_id'],
      ['qty', 'qty'],
      ['fecha', 'fecha'],
      ['operadorId', 'operador_id'],
      ['nota', 'nota'],
    ],
  },
  {
    dexie: db.kitDeliveries,
    sql: 'kit_deliveries',
    fields: [
      ['kitId', 'kit_id'],
      ['qty', 'qty'],
      ['fecha', 'fecha'],
      ['operadorId', 'operador_id'],
      ['nota', 'nota'],
    ],
  },
];

const META_FIELDS: Array<[string, string]> = [
  ['_version', 'version'],
  ['_deleted', 'deleted'],
  ['_deviceId', 'device_id'],
  ['_clientUuid', 'client_uuid'],
  ['createdAt', 'created_at'],
  ['updatedAt', 'updated_at'],
];

type RemoteRow = Record<string, unknown>;

function toRemote(cfg: SyncTableConfig, row: Record<string, unknown>): RemoteRow {
  const out: RemoteRow = { id: row.id as string };
  for (const [local, sql] of cfg.fields) {
    const v = row[local];
    if (v === undefined) continue;
    out[sql] = sql === 'is_active' ? (v === 1 ? true : false) : v;
  }
  for (const [local, sql] of META_FIELDS) {
    const v = row[local];
    if (v !== undefined) {
      out[sql] = local === '_deleted' ? v === 1 : v;
    }
  }
  return out;
}

function toLocal(cfg: SyncTableConfig, remote: RemoteRow): Record<string, unknown> {
  const row: Record<string, unknown> = { id: remote.id as string };
  for (const [local, sql] of cfg.fields) {
    const v = remote[sql];
    if (v === undefined) continue;
    row[local] = sql === 'is_active' ? (v ? 1 : 0) : v;
  }
  row._version = Number(remote.version ?? 1);
  row._deleted = remote.deleted ? 1 : 0;
  row._deviceId = (remote.device_id as string) ?? '';
  row._clientUuid = (remote.client_uuid as string) ?? '';
  row._syncedAt = nowISO();
  if (remote.created_at !== undefined) row.createdAt = remote.created_at as string;
  if (remote.updated_at !== undefined) row.updatedAt = remote.updated_at as string;
  return row;
}

async function pushTable(cfg: SyncTableConfig): Promise<number> {
  if (!supabase) return 0;
  const all = await cfg.dexie.toArray();
  const dirty = all.filter((r) => r._syncedAt === null);
  if (dirty.length === 0) return 0;

  const rows = dirty.map((r) => toRemote(cfg, r as unknown as Record<string, unknown>));
  // ponytail: upsert por (device_id, client_uuid) = idempotente ante reintentos
  const { error } = await supabase
    .from(cfg.sql)
    .upsert(rows, { onConflict: 'device_id,client_uuid' });

  if (error) throw error;
  const ts = nowISO();
  await Promise.all(dirty.map((r) => cfg.dexie.update(r.id, { _syncedAt: ts })));
  return dirty.length;
}

async function pullTable(cfg: SyncTableConfig): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.from(cfg.sql).select('*');
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const local = await cfg.dexie.toArray();
  const byId = new Map(local.map((r) => [r.id as string, r]));

  let applied = 0;
  for (const remote of data as RemoteRow[]) {
    const row = toLocal(cfg, remote);
    const existing = byId.get(row.id as string);
    // LWW por version; si la local está pendiente de push (más nueva) gana local.
    if (existing) {
      const localVersion = Number(existing._version ?? 0);
      if (existing._syncedAt === null || localVersion >= (row._version as number)) continue;
      await cfg.dexie.put(row);
      applied++;
    } else {
      await cfg.dexie.put(row);
      applied++;
    }
  }
  return applied;
}

export { syncEnabled } from './supabase';

export interface SyncResult {
  pushed: number;
  pulled: number;
}

export async function syncNow(): Promise<SyncResult> {
  if (!syncEnabled) return { pushed: 0, pulled: 0 };
  let pushed = 0;
  let pulled = 0;
  // ponytail: push antes que pull → la pendiente local no se pisa con la remota
  for (const cfg of TABLES) {
    pushed += await pushTable(cfg);
  }
  for (const cfg of TABLES) {
    pulled += await pullTable(cfg);
  }
  return { pushed, pulled };
}