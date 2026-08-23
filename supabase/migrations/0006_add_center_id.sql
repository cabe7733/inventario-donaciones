-- Donario v2: Agregar center_id a tablas existentes
-- Fase 2: Multi-tenant migration

-- ================= AGREGAR CENTER_ID =================

-- Solo agregar si no existe (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'center_id') THEN
    ALTER TABLE categories ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'center_id') THEN
    ALTER TABLE units ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'center_id') THEN
    ALTER TABLE products ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medications' AND column_name = 'center_id') THEN
    ALTER TABLE medications ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medication_lots' AND column_name = 'center_id') THEN
    ALTER TABLE medication_lots ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'center_id') THEN
    ALTER TABLE movements ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operadores' AND column_name = 'center_id') THEN
    ALTER TABLE operadores ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kits' AND column_name = 'center_id') THEN
    ALTER TABLE kits ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kit_builds' AND column_name = 'center_id') THEN
    ALTER TABLE kit_builds ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kit_deliveries' AND column_name = 'center_id') THEN
    ALTER TABLE kit_deliveries ADD COLUMN center_id UUID REFERENCES centers(id);
  END IF;
END $$;

-- ================= CREAR CENTRO POR DEFECTO Y MIGRAR DATOS =================

DO $$
DECLARE default_center_id UUID;
BEGIN
  -- Crear centro por defecto si no existe
  INSERT INTO centers (name, slug, created_by)
  VALUES ('Centro Principal', 'centro-principal', NULL)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO default_center_id FROM centers WHERE slug = 'centro-principal';

  -- Migrar datos existentes al centro por defecto
  UPDATE categories SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE units SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE products SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE medications SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE medication_lots SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE movements SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE operadores SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE kits SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE kit_builds SET center_id = default_center_id WHERE center_id IS NULL;
  UPDATE kit_deliveries SET center_id = default_center_id WHERE center_id IS NULL;
END $$;

-- ================= HACER CENTER_ID NOT NULL DESPUÉS DE POBLAR =================

DO $$
BEGIN
  -- Solo aplicar NOT NULL si todas las filas tienen center_id
  IF NOT EXISTS (SELECT 1 FROM categories WHERE center_id IS NULL) THEN
    ALTER TABLE categories ALTER COLUMN center_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM units WHERE center_id IS NULL) THEN
    ALTER TABLE units ALTER COLUMN center_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE center_id IS NULL) THEN
    ALTER TABLE products ALTER COLUMN center_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM medications WHERE center_id IS NULL) THEN
    ALTER TABLE medications ALTER COLUMN center_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM movements WHERE center_id IS NULL) THEN
    ALTER TABLE movements ALTER COLUMN center_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM kits WHERE center_id IS NULL) THEN
    ALTER TABLE kits ALTER COLUMN center_id SET NOT NULL;
  END IF;
END $$;

-- ================= ÍNDICES PARA QUERIES POR CENTRO =================

CREATE INDEX IF NOT EXISTS idx_categories_center ON categories (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_units_center ON units (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_center ON products (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_medications_center ON medications (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_medication_lots_center ON medication_lots (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_movements_center ON movements (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_operadores_center ON operadores (center_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kits_center ON kits (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_kit_builds_center ON kit_builds (center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_kit_deliveries_center ON kit_deliveries (center_id) WHERE deleted = false;
