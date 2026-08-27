-- Donario v3: orders.updated_at faltaba desde 0008.
-- 0034 (replace_order / delete_order / trigger / get_orders_for_center)
-- asume la columna; agregarla aquí destraba la edición de salidas.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
