-- Donario v3: Garantiza que cada centro tenga una bodega PRINCIPAL activa.
-- Idempotente: si ya existe, no hace nada.
-- Resuelve el caso de centros creados sin bodega por defecto, donde la RPC
-- de import skipea todas las filas porque no encuentra warehouse_id.

INSERT INTO warehouses (center_id, name, code)
SELECT c.id, 'Bodega Principal', 'PRINCIPAL'
FROM centers c
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.center_id = c.id AND w.code = 'PRINCIPAL'
);