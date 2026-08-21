-- Seed inicial: unidades y categorías por defecto.
-- Idempotente: ON CONFLICT DO NOTHING.

-- Unidades (product scope)
INSERT INTO units (id, name, abbreviation, scope, is_active, device_id, client_uuid, version, deleted)
VALUES
  (gen_random_uuid(), 'Unidad', 'un', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Kilogramo', 'kg', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Gramo', 'g', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Litro', 'L', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Mililitro', 'ml', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Caja', 'cja', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Paquete', 'pqte', 'product', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Docena', 'doc', 'product', true, 'seed', gen_random_uuid(), 1, false)
ON CONFLICT (name) DO NOTHING;

-- Unidades (medication scope)
INSERT INTO units (id, name, abbreviation, scope, is_active, device_id, client_uuid, version, deleted)
VALUES
  (gen_random_uuid(), 'Unidad', 'un', 'medication', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Gramo', 'g', 'medication', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Mililitro', 'ml', 'medication', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Caja', 'cja', 'medication', true, 'seed', gen_random_uuid(), 1, false),
  (gen_random_uuid(), 'Paquete', 'pqte', 'medication', true, 'seed', gen_random_uuid(), 1, false)
ON CONFLICT (name) DO NOTHING;

-- Categoría por defecto para medicamentos
INSERT INTO categories (id, name, color, icon_key, "order", scope, is_active, device_id, client_uuid, version, deleted)
VALUES (gen_random_uuid(), 'Medicamentos', 'primary-600', 'pills', 0, 'medication', true, 'seed', gen_random_uuid(), 1, false)
ON CONFLICT (name) DO NOTHING;
