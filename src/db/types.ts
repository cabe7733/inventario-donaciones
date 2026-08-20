export type ID = string;
export type ISODate = string; // ISO 8601 UTC
export type ISODateLocal = string; // YYYY-MM-DD (sin zona horaria) para vencimientos

export type ItemType = 'product' | 'medication' | 'kit';
export type MovementKind = 'entrada' | 'salida';
export type Scope = 'product' | 'medication';

// ponytail: IndexedDB no indexa booleanos; _deleted se almacena como 0/1
export type DeletedFlag = 0 | 1;

export interface SyncMeta {
  _version: number;
  _deleted: DeletedFlag;
  _syncedAt: ISODate | null; // null = pendiente de sync
  _deviceId: ID;
  _clientUuid: ID; // clave de idempotencia para operaciones create
}

export interface Product extends SyncMeta {
  id: ID;
  name: string;
  aliases: string[];
  categoryId: ID | null;
  unitId: ID;
  minStock: number | null;
  totalStock: number;
  isActive: 0 | 1;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Medication extends SyncMeta {
  id: ID;
  name: string;
  presentacion: string;
  categoriaId: ID | null;
  unitId: ID;
  isActive: 0 | 1;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MedicationLot extends SyncMeta {
  id: ID;
  medicationId: ID;
  lote: string;
  fechaVencimiento: ISODateLocal | null;
  stock: number;
  createdAt: ISODate;
}

export interface Category extends SyncMeta {
  id: ID;
  name: string;
  color: string;
  iconKey: string;
  order: number;
  isActive: 0 | 1;
  scope: Scope;
}

export interface Unit extends SyncMeta {
  id: ID;
  name: string;
  abbreviation: string;
  isActive: 0 | 1;
  scope: Scope;
}

export interface Movement extends SyncMeta {
  id: ID;
  kind: MovementKind;
  itemType: ItemType;
  itemId: ID;
  qty: number;
  unitId: ID;
  loteId: ID | null;
  fecha: ISODate;
  operadorId: ID | null;
  nota: string;
  createdAt: ISODate;
}

export interface Kit extends SyncMeta {
  id: ID;
  name: string;
  categoryId: ID | null;
  unitId: ID;
  totalStock: number;
  isActive: 0 | 1;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface KitComponent {
  id: ID;
  kitId: ID;
  productId: ID;
  qty: number;
  unitId: ID;
  order: number;
}

export interface KitBuild extends SyncMeta {
  id: ID;
  kitId: ID;
  qty: number;
  fecha: ISODate;
  operadorId: ID | null;
  nota: string;
  createdAt: ISODate;
}

export interface KitDelivery extends SyncMeta {
  id: ID;
  kitId: ID;
  qty: number;
  fecha: ISODate;
  operadorId: ID | null;
  nota: string;
  createdAt: ISODate;
}

export type SyncQueueOp =
  | 'create'
  | 'update'
  | 'delete'
  | 'movement'
  | 'kitBuild'
  | 'kitDelivery';

export type SyncQueueStatus = 'pending' | 'dead' | 'discarded';

export interface SyncQueueRow {
  id: ID;
  op: SyncQueueOp;
  table: string;
  rowId: ID;
  payload: string; // JSON snapshot al momento del encolado
  status: SyncQueueStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: ISODate | null;
  createdAt: ISODate;
}

export interface Operador {
  id: ID;
  name: string;
  isActive: 0 | 1;
}

export interface MetaRow {
  key: string;
  value: string; // JSON-encoded
}
