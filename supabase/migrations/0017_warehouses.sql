-- Donario v3: Bodegas por centro
-- Inventario clasificado por bodega: orders y movements llevan warehouse_id.

-- ================= TABLA WAREHOUSES =================

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_center ON warehouses (center_id) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_set_updated_at ON warehouses;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ponytail: sin tabla de auditoría de bodegas; el historial por bodega sale
-- de movements (filtro warehouse_id). Agregar warehouses_audit si hace falta.

-- ================= BODEGA POR DEFECTO POR CENTRO =================

INSERT INTO warehouses (center_id, name, code)
SELECT c.id, 'Bodega Principal', 'PRINCIPAL'
FROM centers c
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.center_id = c.id AND w.code = 'PRINCIPAL'
);

-- ================= WAREHOUSE_ID EN ORDERS Y MOVEMENTS =================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- Backfill: lo existente va a la bodega principal de su centro
UPDATE orders o SET warehouse_id = w.id
FROM warehouses w
WHERE w.center_id = o.center_id AND w.code = 'PRINCIPAL' AND o.warehouse_id IS NULL;

UPDATE movements m SET warehouse_id = w.id
FROM warehouses w
WHERE w.center_id = m.center_id AND w.code = 'PRINCIPAL' AND m.warehouse_id IS NULL;

ALTER TABLE orders ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE movements ALTER COLUMN warehouse_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON movements (warehouse_id) WHERE deleted = false;

-- ================= RLS =================

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_warehouses" ON warehouses
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_warehouses" ON warehouses
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_warehouses" ON warehouses
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_warehouses" ON warehouses
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= RPC: CREATE ORDER CON BODEGA =================

DROP FUNCTION IF EXISTS public.create_order(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_order(
  p_order_type TEXT,
  p_warehouse_id UUID,
  p_items JSONB,
  p_donor_full_name TEXT DEFAULT NULL,
  p_donor_id_number TEXT DEFAULT NULL,
  p_donor_phone TEXT DEFAULT NULL,
  p_donor_email TEXT DEFAULT NULL,
  p_donor_entity_name TEXT DEFAULT NULL,
  p_donor_entity_rfc TEXT DEFAULT NULL,
  p_vehicle_plate TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT NULL,
  p_vehicle_color TEXT DEFAULT NULL,
  p_recipient_full_name TEXT DEFAULT NULL,
  p_recipient_id_number TEXT DEFAULT NULL,
  p_recipient_phone TEXT DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL,
  p_recipient_entity_name TEXT DEFAULT NULL,
  p_recipient_entity_rfc TEXT DEFAULT NULL,
  p_recipient_type TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  center UUID;
  user_role TEXT;
  item_qty NUMERIC;
  item_id UUID;
  item_type TEXT;
  lote_id UUID;
BEGIN
  center := public.get_user_center_id();
  user_role := public.get_user_role();

  IF user_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'No tienes permiso para crear órdenes';
  END IF;

  -- La bodega debe pertenecer al centro del usuario y estar activa
  IF NOT EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = p_warehouse_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bodega inválida o inactiva';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un item a la orden';
  END IF;

  INSERT INTO orders (
    center_id, warehouse_id, order_type,
    donor_full_name, donor_id_number, donor_phone, donor_email,
    donor_entity_name, donor_entity_rfc,
    vehicle_plate, vehicle_type, vehicle_color,
    recipient_full_name, recipient_id_number, recipient_phone, recipient_email,
    recipient_entity_name, recipient_entity_rfc, recipient_type,
    created_by, notes
  ) VALUES (
    center, p_warehouse_id, p_order_type,
    p_donor_full_name, p_donor_id_number, p_donor_phone, p_donor_email,
    p_donor_entity_name, p_donor_entity_rfc,
    p_vehicle_plate, p_vehicle_type, p_vehicle_color,
    p_recipient_full_name, p_recipient_id_number, p_recipient_phone, p_recipient_email,
    p_recipient_entity_name, p_recipient_entity_rfc, p_recipient_type,
    auth.uid(), p_notes
  ) RETURNING id INTO new_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_type := (item->>'item_type')::TEXT;
    item_id := (item->>'item_id')::UUID;
    item_qty := (item->>'qty')::NUMERIC;
    lote_id := (item->>'lote_id')::UUID;

    INSERT INTO order_items (order_id, item_type, item_id, qty, unit_id, lote_id, notes)
    VALUES (
      new_order_id,
      item_type,
      item_id,
      item_qty,
      (item->>'unit_id')::UUID,
      lote_id,
      COALESCE((item->>'notes')::TEXT, '')
    );

    -- ponytail: stock global en products/kits/lots; la vista por bodega se
    -- deriva de movements. Validación de salidas sigue contra stock global.
    IF item_type = 'product' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE products SET total_stock = total_stock + item_qty
        WHERE id = item_id;
      ELSE
        IF (SELECT total_stock FROM products WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el producto %', item_id;
        END IF;
        UPDATE products SET total_stock = total_stock - item_qty
        WHERE id = item_id;
      END IF;

    ELSIF item_type = 'medication' AND lote_id IS NOT NULL THEN
      IF p_order_type = 'entrada' THEN
        UPDATE medication_lots SET stock = stock + item_qty
        WHERE id = lote_id;
      ELSE
        IF (SELECT stock FROM medication_lots WHERE id = lote_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el lote %', lote_id;
        END IF;
        UPDATE medication_lots SET stock = stock - item_qty
        WHERE id = lote_id;
      END IF;

    ELSIF item_type = 'kit' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE kits SET total_stock = total_stock + item_qty
        WHERE id = item_id;
      ELSE
        IF (SELECT total_stock FROM kits WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el kit %', item_id;
        END IF;
        UPDATE kits SET total_stock = total_stock - item_qty
        WHERE id = item_id;
      END IF;
    END IF;

    INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, fecha, operador_id, nota, center_id, warehouse_id)
    VALUES (
      p_order_type,
      item_type,
      item_id,
      item_qty,
      (item->>'unit_id')::UUID,
      lote_id,
      now(),
      NULL,
      COALESCE((item->>'notes')::TEXT, ''),
      center,
      p_warehouse_id
    );
  END LOOP;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= RPC: INFORME POR BODEGA =================

CREATE OR REPLACE FUNCTION public.get_warehouse_report(
  p_warehouse_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  item_type TEXT,
  item_id UUID,
  item_name TEXT,
  total_in NUMERIC,
  total_out NUMERIC,
  current_stock NUMERIC
) AS $$
DECLARE
  v_center UUID;
BEGIN
  SELECT w.center_id INTO v_center FROM warehouses w WHERE w.id = p_warehouse_id;
  IF v_center IS NULL OR v_center <> public.get_user_center_id() THEN
    RAISE EXCEPTION 'Bodega no encontrada';
  END IF;

  RETURN QUERY
  SELECT
    m.item_type,
    m.item_id,
    COALESCE(p.name, md.name, k.name, m.item_id::text) AS item_name,
    COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)::NUMERIC AS total_in,
    COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'), 0)::NUMERIC AS total_out,
    (COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)
      - COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'), 0))::NUMERIC AS current_stock
  FROM movements m
  LEFT JOIN products p ON m.item_type = 'product' AND p.id = m.item_id
  LEFT JOIN medications md ON m.item_type = 'medication' AND md.id = m.item_id
  LEFT JOIN kits k ON m.item_type = 'kit' AND k.id = m.item_id
  WHERE m.warehouse_id = p_warehouse_id
    AND m.deleted = false
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha <= p_to)
  GROUP BY m.item_type, m.item_id, p.name, md.name, k.name
  ORDER BY item_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================= IMPORT RPCs: ASIGNAR BODEGA PRINCIPAL =================
-- ponytail: las importaciones masivas caen siempre en la bodega PRINCIPAL
-- del centro. Para importar a otra bodega, agregar p_warehouse_id.

CREATE OR REPLACE FUNCTION import_products_from_rows(
  p_rows jsonb,
  p_movement_note text DEFAULT 'Importación inicial',
  p_user_id uuid DEFAULT NULL,
  p_center_id uuid DEFAULT NULL
)
RETURNS jsonb
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
  v_existing_product record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_ok int := 0;
BEGIN
  SELECT id INTO v_warehouse_id
  FROM warehouses
  WHERE center_id = p_center_id AND code = 'PRINCIPAL'
  LIMIT 1;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_product := r->>'product';
    v_category := r->>'category';
    v_unit := COALESCE(r->>'unit', 'Unidad');
    v_qty := (r->>'qty')::numeric;

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
      UPDATE products
        SET total_stock = v_existing_product.total_stock + v_qty,
            category_id = v_cat_id,
            unit_id = v_unit_id
      WHERE id = v_product_id;
      v_products_updated := v_products_updated + 1;
    END IF;

    IF v_qty > 0 THEN
      INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id, warehouse_id)
      VALUES ('entrada', 'product', v_product_id, v_qty, v_unit_id, NULL, NULL, p_movement_note, p_center_id, v_warehouse_id);
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
)
RETURNS jsonb
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
  v_existing_med record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_med_id uuid;
  v_lot_id uuid;
  v_warehouse_id uuid;
  v_meds_created int := 0;
  v_meds_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_lots_created int := 0;
  v_ok int := 0;
BEGIN
  SELECT id INTO v_warehouse_id
  FROM warehouses
  WHERE center_id = p_center_id AND code = 'PRINCIPAL'
  LIMIT 1;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_medication := r->>'medication';
    v_category := r->>'category';
    v_unit := COALESCE(r->>'unit', 'Unidad');
    v_qty := COALESCE((r->>'qty')::numeric, 0);
    v_presentation := COALESCE(r->>'presentation', '');
    v_lot := r->>'lot';
    v_expiry := r->>'expiry';

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
      UPDATE medications
        SET categoria_id = v_cat_id,
            unit_id = v_unit_id,
            presentacion = v_presentation
      WHERE id = v_med_id;
      v_meds_updated := v_meds_updated + 1;
    END IF;

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
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id, warehouse_id)
        VALUES ('entrada', 'medication', v_med_id, v_qty, v_unit_id, v_lot_id, NULL, p_movement_note, p_center_id, v_warehouse_id);
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
