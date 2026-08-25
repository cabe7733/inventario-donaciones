-- Donario v3: warehouse_id en kits.
-- El form de kit ahora pide la bodega de origen al definir el kit.
-- Esto permite simular y auto-generar ensambles sin pedirla de nuevo
-- en el modal de acción.

ALTER TABLE kits
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

CREATE INDEX IF NOT EXISTS idx_kits_warehouse ON kits(warehouse_id) WHERE deleted = false;
