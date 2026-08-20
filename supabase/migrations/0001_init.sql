-- Donario: esquema inicial (espejo del esquema Dexie)
-- v1 = 100% local. Estas tablas son el target de sync cuando se active adapter.supabase.

create extension if not exists "pgcrypto";

-- ================= UTILIDAD =================

-- updated_at automático en todas las tablas con columna updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

-- ================= ENTIDADES =================

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'primary-600',
  icon_key text not null default 'box',
  "order" int not null default 0,
  scope text not null default 'product' check (scope in ('product', 'medication')),
  is_active boolean not null default true,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null,
  scope text not null default 'product' check (scope in ('product', 'medication')),
  is_active boolean not null default true,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  category_id uuid references categories(id),
  unit_id uuid references units(id),
  min_stock numeric,
  total_stock numeric not null default 0,
  is_active boolean not null default true,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);
create index if not exists products_name_idx on products (name);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  presentacion text not null default '',
  categoria_id uuid references categories(id),
  unit_id uuid references units(id),
  is_active boolean not null default true,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

create table if not exists medication_lots (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  lote text not null,
  fecha_vencimiento date,
  stock numeric not null default 0,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);
create index if not exists lots_medication_idx on medication_lots (medication_id) where deleted = false;
create index if not exists lots_vencimiento_idx on medication_lots (fecha_vencimiento) where deleted = false;

-- ================= MOVIMIENTOS (append-only, idempotentes) =================

create table if not exists operadores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('entrada', 'salida')),
  item_type text not null check (item_type in ('product', 'medication', 'kit')),
  item_id uuid not null,
  qty numeric not null check (qty > 0),
  unit_id uuid references units(id),
  lote_id uuid references medication_lots(id),
  fecha timestamptz not null default now(),
  operador_id uuid references operadores(id),
  nota text not null default '',
  device_id text not null,
  client_uuid uuid not null,          -- idempotencia: el mismo movimiento nunca duplica
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);
create index if not exists movements_item_idx on movements (item_type, item_id);
create index if not exists movements_created_idx on movements (created_at desc);

-- ================= KITS =================

create table if not exists kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id),
  unit_id uuid references units(id),
  total_stock numeric not null default 0,
  is_active boolean not null default true,
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

create table if not exists kit_components (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric not null check (qty > 0),
  unit_id uuid references units(id),
  "order" int not null default 0
);
create index if not exists kit_components_kit_idx on kit_components (kit_id, "order");

create table if not exists kit_builds (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id),
  qty numeric not null check (qty > 0),
  fecha timestamptz not null default now(),
  operador_id uuid references operadores(id),
  nota text not null default '',
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

create table if not exists kit_deliveries (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id),
  qty numeric not null check (qty > 0),
  fecha timestamptz not null default now(),
  operador_id uuid references operadores(id),
  nota text not null default '',
  device_id text not null,
  client_uuid uuid not null,
  version int not null default 1,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_uuid)
);

-- ================= SYNC AUDIT =================

create table if not exists sync_log (
  id bigserial primary key,
  device_id text not null,
  operation text not null check (operation in ('push', 'pull', 'conflict', 'discard')),
  table_name text,
  row_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sync_log_device_idx on sync_log (device_id);
create index if not exists sync_log_created_idx on sync_log (created_at desc);

-- triggers updated_at
do $$
declare t text;
begin
  foreach t in array array['categories','units','products','medications','medication_lots','movements','kits','kit_builds','kit_deliveries'] loop
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ================= RLS =================
-- v1: única organización, acceso anónimo total.
-- Cuando llegue auth por operador en v1.1, estrechar a auth.uid().

alter table categories enable row level security;
alter table units enable row level security;
alter table products enable row level security;
alter table medications enable row level security;
alter table medication_lots enable row level security;
alter table movements enable row level security;
alter table operadores enable row level security;
alter table kits enable row level security;
alter table kit_components enable row level security;
alter table kit_builds enable row level security;
alter table kit_deliveries enable row level security;
alter table sync_log enable row level security;

create policy "anon full access" on categories for all using (true) with check (true);
create policy "anon full access" on units for all using (true) with check (true);
create policy "anon full access" on products for all using (true) with check (true);
create policy "anon full access" on medications for all using (true) with check (true);
create policy "anon full access" on medication_lots for all using (true) with check (true);
create policy "anon full access" on movements for all using (true) with check (true);
create policy "anon full access" on operadores for all using (true) with check (true);
create policy "anon full access" on kits for all using (true) with check (true);
create policy "anon full access" on kit_components for all using (true) with check (true);
create policy "anon full access" on kit_builds for all using (true) with check (true);
create policy "anon full access" on kit_deliveries for all using (true) with check (true);
create policy "anon full access" on sync_log for all using (true) with check (true);