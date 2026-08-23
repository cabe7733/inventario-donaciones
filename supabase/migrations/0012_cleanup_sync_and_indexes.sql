-- Donario: Drop dead sync columns, add missing indexes, fix gaps
-- Safe: columns are NOT referenced by any active query path

-- ================= 1. DROP SYNC COLUMNS =================
-- device_id, client_uuid, version are sync metadata. App is now Supabase-online.
-- We keep `deleted` (soft-delete pattern still used in all fetch queries).

ALTER TABLE categories DROP COLUMN IF EXISTS device_id;
ALTER TABLE categories DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE categories DROP COLUMN IF EXISTS version;

ALTER TABLE units DROP COLUMN IF EXISTS device_id;
ALTER TABLE units DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE units DROP COLUMN IF EXISTS version;

ALTER TABLE products DROP COLUMN IF EXISTS device_id;
ALTER TABLE products DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE products DROP COLUMN IF EXISTS version;

ALTER TABLE medications DROP COLUMN IF EXISTS device_id;
ALTER TABLE medications DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE medications DROP COLUMN IF EXISTS version;

ALTER TABLE medication_lots DROP COLUMN IF EXISTS device_id;
ALTER TABLE medication_lots DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE medication_lots DROP COLUMN IF EXISTS version;

ALTER TABLE movements DROP COLUMN IF EXISTS device_id;
ALTER TABLE movements DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE movements DROP COLUMN IF EXISTS version;

ALTER TABLE kits DROP COLUMN IF EXISTS device_id;
ALTER TABLE kits DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE kits DROP COLUMN IF EXISTS version;

ALTER TABLE kit_builds DROP COLUMN IF EXISTS device_id;
ALTER TABLE kit_builds DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE kit_builds DROP COLUMN IF EXISTS version;

ALTER TABLE kit_deliveries DROP COLUMN IF EXISTS device_id;
ALTER TABLE kit_deliveries DROP COLUMN IF EXISTS client_uuid;
ALTER TABLE kit_deliveries DROP COLUMN IF EXISTS version;

-- Also drop the unique constraints that depended on (device_id, client_uuid)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_device_id_client_uuid_key;
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_device_id_client_uuid_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_device_id_client_uuid_key;
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_device_id_client_uuid_key;
ALTER TABLE medication_lots DROP CONSTRAINT IF EXISTS medication_lots_device_id_client_uuid_key;
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_device_id_client_uuid_key;
ALTER TABLE kits DROP CONSTRAINT IF EXISTS kits_device_id_client_uuid_key;
ALTER TABLE kit_builds DROP CONSTRAINT IF EXISTS kit_builds_device_id_client_uuid_key;
ALTER TABLE kit_deliveries DROP CONSTRAINT IF EXISTS kit_deliveries_device_id_client_uuid_key;

-- ================= 2. ADD MISSING INDEXES =================

-- FK indexes for joins/filters
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_products_unit ON products (unit_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_medications_categoria ON medications (categoria_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_medications_unit ON medications (unit_id) WHERE deleted = false;

-- Query pattern indexes
CREATE INDEX IF NOT EXISTS idx_movements_center_fecha ON movements (center_id, fecha DESC) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_movements_kind ON movements (kind, center_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders (center_id, order_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications (name) WHERE deleted = false;

-- ================= 3. ADD UPDATED_AT WHERE MISSING =================

ALTER TABLE operadores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE kit_components ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add trigger for operadores and kit_components
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at' AND tgrelid = 'operadores'::regclass) THEN
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON operadores
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at' AND tgrelid = 'kit_components'::regclass) THEN
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON kit_components
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ================= 4. UPDATE IMPORT RPCs (drop sync params) =================

CREATE OR REPLACE FUNCTION import_products_from_rows(
  p_rows jsonb,
  p_movement_note text DEFAULT 'Importación inicial',
  p_user_id uuid DEFAULT NULL,
  p_center_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  r jsonb;
  v_product text;
  v_category text;
  v_unit text;
  v_qty numeric;
  v_existing_cat record;
  v_existing_unit record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_existing_product record;
  v_product_id uuid;
  v_new_stock numeric;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_ok int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_product := r->>'product';
    v_category := r->>'category';
    v_unit := COALESCE(r->>'unit', 'Unidad');
    v_qty := (r->>'qty')::numeric;

    -- Find or create category
    SELECT id INTO v_existing_cat
    FROM categories
    WHERE lower(name) = lower(v_category) AND scope = 'product' AND deleted = false
    LIMIT 1;

    IF v_existing_cat.id IS NULL THEN
      v_cat_id := gen_random_uuid();
      INSERT INTO categories (id, name, color, icon_key, "order", scope, center_id)
      VALUES (v_cat_id, v_category, 'primary-600', 'box', 0, 'product', p_center_id);
      v_cats_created := v_cats_created + 1;
    ELSE
      v_cat_id := v_existing_cat.id;
    END IF;

    -- Find or create unit
    SELECT id INTO v_existing_unit
    FROM units
    WHERE lower(name) = lower(v_unit) AND scope = 'product' AND deleted = false
    LIMIT 1;

    IF v_existing_unit.id IS NULL THEN
      v_unit_id := gen_random_uuid();
      INSERT INTO units (id, name, abbreviation, scope, center_id)
      VALUES (v_unit_id, v_unit, lower(substring(v_unit, 1, 4)), 'product', p_center_id);
      v_units_created := v_units_created + 1;
    ELSE
      v_unit_id := v_existing_unit.id;
    END IF;

    -- Find or create product
    SELECT id, total_stock INTO v_existing_product
    FROM products
    WHERE lower(name) = lower(v_product) AND deleted = false
    LIMIT 1;

    IF v_existing_product.id IS NULL THEN
      v_product_id := gen_random_uuid();
      INSERT INTO products (id, name, aliases, category_id, unit_id, min_stock, total_stock, is_active, center_id)
      VALUES (v_product_id, v_product, '{}', v_cat_id, v_unit_id, NULL, v_qty, true, p_center_id);
      v_products_created := v_products_created + 1;
    ELSE
      v_product_id := v_existing_product.id;
      UPDATE products SET total_stock = v_existing_product.total_stock + v_qty, category_id = v_cat_id, unit_id = v_unit_id
      WHERE id = v_product_id;
      v_products_updated := v_products_updated + 1;
    END IF;

    -- Log movement
    IF v_qty > 0 THEN
      INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id)
      VALUES ('entrada', 'product', v_product_id, v_qty, v_unit_id, NULL, p_user_id, p_movement_note, p_center_id);
    END IF;

    v_ok := v_ok + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'createdCats', v_cats_created,
    'createdUnits', v_units_created,
    'productsCreated', v_products_created,
    'productsUpdated', v_products_updated
  );
END $$;

CREATE OR REPLACE FUNCTION import_medications_from_rows(
  p_rows jsonb,
  p_movement_note text DEFAULT 'Importación inicial',
  p_user_id uuid DEFAULT NULL,
  p_center_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  r jsonb;
  v_medication text;
  v_category text;
  v_unit text;
  v_qty numeric;
  v_presentation text;
  v_lot text;
  v_expiry text;
  v_existing_cat record;
  v_existing_unit record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_existing_med record;
  v_med_id uuid;
  v_lot_id uuid;
  v_meds_created int := 0;
  v_meds_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_lots_created int := 0;
  v_ok int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_medication := r->>'medication';
    v_category := r->>'category';
    v_unit := COALESCE(r->>'unit', 'Unidad');
    v_qty := COALESCE((r->>'qty')::numeric, 0);
    v_presentation := COALESCE((r->>'presentation'), '');
    v_lot := r->>'lot';
    v_expiry := r->>'expiry';

    -- Find or create category
    SELECT id INTO v_existing_cat
    FROM categories
    WHERE lower(name) = lower(v_category) AND scope = 'medication' AND deleted = false
    LIMIT 1;

    IF v_existing_cat.id IS NULL THEN
      v_cat_id := gen_random_uuid();
      INSERT INTO categories (id, name, color, icon_key, "order", scope, center_id)
      VALUES (v_cat_id, v_category, 'primary-600', 'pills', 0, 'medication', p_center_id);
      v_cats_created := v_cats_created + 1;
    ELSE
      v_cat_id := v_existing_cat.id;
    END IF;

    -- Find or create unit
    SELECT id INTO v_existing_unit
    FROM units
    WHERE lower(name) = lower(v_unit) AND scope = 'medication' AND deleted = false
    LIMIT 1;

    IF v_existing_unit.id IS NULL THEN
      v_unit_id := gen_random_uuid();
      INSERT INTO units (id, name, abbreviation, scope, center_id)
      VALUES (v_unit_id, v_unit, lower(substring(v_unit, 1, 4)), 'medication', p_center_id);
      v_units_created := v_units_created + 1;
    ELSE
      v_unit_id := v_existing_unit.id;
    END IF;

    -- Find or create medication
    SELECT id INTO v_existing_med
    FROM medications
    WHERE lower(name) = lower(v_medication) AND deleted = false
    LIMIT 1;

    IF v_existing_med.id IS NULL THEN
      v_med_id := gen_random_uuid();
      INSERT INTO medications (id, name, presentacion, categoria_id, unit_id, is_active, center_id)
      VALUES (v_med_id, v_medication, v_presentation, v_cat_id, v_unit_id, true, p_center_id);
      v_meds_created := v_meds_created + 1;
    ELSE
      v_med_id := v_existing_med.id;
      UPDATE medications SET categoria_id = v_cat_id, unit_id = v_unit_id, presentacion = v_presentation
      WHERE id = v_med_id;
      v_meds_updated := v_meds_updated + 1;
    END IF;

    -- Handle lot
    IF v_lot IS NOT NULL AND v_lot <> '' THEN
      SELECT id INTO v_lot_id
      FROM medication_lots
      WHERE medication_id = v_med_id AND lote = v_lot AND deleted = false
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        v_lot_id := gen_random_uuid();
        INSERT INTO medication_lots (id, medication_id, lote, fecha_vencimiento, stock, center_id)
        VALUES (v_lot_id, v_med_id, v_lot,
                CASE WHEN v_expiry <> '' THEN v_expiry::date ELSE NULL END,
                v_qty, p_center_id);
        v_lots_created := v_lots_created + 1;
      ELSE
        UPDATE medication_lots
        SET stock = stock + v_qty,
            fecha_vencimiento = COALESCE(
              CASE WHEN v_expiry <> '' THEN v_expiry::date ELSE NULL END,
              fecha_vencimiento
            )
        WHERE id = v_lot_id;
      END IF;

      IF v_qty > 0 THEN
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id)
        VALUES ('entrada', 'medication', v_med_id, v_qty, v_unit_id, v_lot_id, p_user_id, p_movement_note, p_center_id);
      END IF;
    END IF;

    v_ok := v_ok + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'createdCats', v_cats_created,
    'createdUnits', v_units_created,
    'medsCreated', v_meds_created,
    'medsUpdated', v_meds_updated,
    'lotsCreated', v_lots_created
  );
END $$;

-- ================= 5. ADD MISSING DELETE/UPDATE POLICIES =================

-- movements: add update/delete for admins (stock corrections)
DROP POLICY IF EXISTS "center_admins_can_update_movements" ON movements;
CREATE POLICY "center_admins_can_update_movements" ON movements
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "super_admin_can_delete_movements" ON movements;
CREATE POLICY "super_admin_can_delete_movements" ON movements
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- kit_builds/kit_deliveries: add update/delete for admins
DROP POLICY IF EXISTS "center_admins_can_update_kit_builds" ON kit_builds;
CREATE POLICY "center_admins_can_update_kit_builds" ON kit_builds
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "center_admins_can_delete_kit_builds" ON kit_builds;
CREATE POLICY "center_admins_can_delete_kit_builds" ON kit_builds
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "center_admins_can_update_kit_deliveries" ON kit_deliveries;
CREATE POLICY "center_admins_can_update_kit_deliveries" ON kit_deliveries
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "center_admins_can_delete_kit_deliveries" ON kit_deliveries;
CREATE POLICY "center_admins_can_delete_kit_deliveries" ON kit_deliveries
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- orders: add update/delete for admins
DROP POLICY IF EXISTS "center_admins_can_update_orders" ON orders;
CREATE POLICY "center_admins_can_update_orders" ON orders
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "super_admin_can_delete_orders" ON orders;
CREATE POLICY "super_admin_can_delete_orders" ON orders
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- order_items: add insert/update/delete for admins
DROP POLICY IF EXISTS "center_admins_can_insert_order_items" ON order_items;
CREATE POLICY "center_admins_can_insert_order_items" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "center_admins_can_update_order_items" ON order_items;
CREATE POLICY "center_admins_can_update_order_items" ON order_items
  FOR UPDATE USING (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "center_admins_can_delete_order_items" ON order_items;
CREATE POLICY "center_admins_can_delete_order_items" ON order_items
  FOR DELETE USING (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= 6. DROP UNUSED SYNC_LOG TABLE =================
-- Not referenced by any app code. Was for the old Dexie sync system.

DROP TABLE IF EXISTS sync_log CASCADE;
