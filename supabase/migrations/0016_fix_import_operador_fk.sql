-- Donario: Fix import RPCs — operador_id debe ser NULL.
-- El FK movements_operador_id_fkey referencia la tabla `operadores`
-- (los operarios físicos del centro, sembrada con seed data), NO
-- auth.users. Pasar p_user_id (uuid de auth.users) como operador_id
-- viola el FK y rompe el import.
-- Solución: dejar operador_id en NULL al importar. La app puede asignar
-- un operador después (UI futura).

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
      INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id)
      VALUES ('entrada', 'product', v_product_id, v_qty, v_unit_id, NULL, NULL, p_movement_note, p_center_id);
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
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id)
        VALUES ('entrada', 'medication', v_med_id, v_qty, v_unit_id, v_lot_id, NULL, p_movement_note, p_center_id);
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
