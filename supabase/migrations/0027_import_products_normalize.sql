-- Donario v3: Normalización de nombres en import_products_from_rows.
-- Cambia el match de productos de lower(name) = lower(v_product) a una
-- comparación normalizada (trim + colapso de espacios + lowercase) contra
-- el nombre O cualquier alias. Así "Arroz" / "ARROZ" / "  arroz  " / "arroz "
-- se consideran el mismo producto, y se suma al stock existente en vez de
-- crear duplicados. La parte de sumar al stock ya existía (no se toca).

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
  v_product_norm text;
  v_category text;
  v_unit text;
  v_qty numeric;
  v_warehouse_code text;
  v_donor_id_number text;
  v_existing_cat record;
  v_existing_unit record;
  v_existing_product record;
  v_existing_warehouse record;
  v_existing_donor record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_product_id uuid;
  v_warehouse_id uuid;
  v_donor_id uuid;
  v_donor_name text;
  v_new_stock numeric;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_ok int := 0;
  v_skipped_donor int := 0;
  v_skipped_warehouse int := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_product := r->>'product';
    v_category := r->>'category';
    v_unit := COALESCE(r->>'unit', 'Unidad');
    v_qty := (r->>'qty')::numeric;
    v_warehouse_code := NULLIF(TRIM(COALESCE(r->>'warehouse', '')), '');
    v_donor_id_number := NULLIF(TRIM(COALESCE(r->>'donor_id_number', '')), '');

    -- ponytail: normaliza nombre del producto (trim + colapsa espacios + lower)
    -- para que "Arroz" / "ARROZ" / " arroz " / "arroz" / "arroz  1kg" casen.
    -- El match incluye el nombre y cualquier alias registrado en el producto.
    v_product_norm := lower(regexp_replace(trim(COALESCE(v_product, '')), '\s+', ' ', 'g'));

    -- Resolve warehouse: explicit code wins, otherwise default to PRINCIPAL.
    IF v_warehouse_code IS NOT NULL THEN
      SELECT id, code INTO v_existing_warehouse
      FROM warehouses
      WHERE center_id = p_center_id AND lower(code) = lower(v_warehouse_code) AND is_active = true
      LIMIT 1;
      IF v_existing_warehouse.id IS NULL THEN
        v_skipped_warehouse := v_skipped_warehouse + 1;
        CONTINUE;
      END IF;
      v_warehouse_id := v_existing_warehouse.id;
    ELSE
      SELECT id INTO v_existing_warehouse
      FROM warehouses
      WHERE center_id = p_center_id AND code = 'PRINCIPAL' AND is_active = true
      LIMIT 1;
      IF v_existing_warehouse.id IS NULL THEN
        v_skipped_warehouse := v_skipped_warehouse + 1;
        CONTINUE;
      END IF;
      v_warehouse_id := v_existing_warehouse.id;
    END IF;

    -- Resolve donor by id_number (cédula). Required — skip the row if not found.
    v_donor_id := NULL;
    v_donor_name := NULL;
    IF v_donor_id_number IS NOT NULL THEN
      SELECT id, full_name INTO v_existing_donor
      FROM donors
      WHERE center_id = p_center_id AND id_number = v_donor_id_number AND is_active = true
      LIMIT 1;
      IF v_existing_donor.id IS NULL THEN
        v_skipped_donor := v_skipped_donor + 1;
        CONTINUE;
      END IF;
      v_donor_id := v_existing_donor.id;
      v_donor_name := v_existing_donor.full_name;
    ELSE
      v_skipped_donor := v_skipped_donor + 1;
      CONTINUE;
    END IF;

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

    -- Find existing product: nombre normalizado OR cualquier alias normalizado.
    -- Esto evita que "Arroz" / "ARROZ" / "arroz 1kg" (alias) creen duplicados.
    SELECT id, total_stock INTO v_existing_product
    FROM products
    WHERE deleted = false
      AND (
        lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = v_product_norm
        OR EXISTS (
          SELECT 1 FROM unnest(aliases) a
          WHERE lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = v_product_norm
        )
      )
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

    -- Log movement
    IF v_qty > 0 THEN
      INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, operador_id, nota, center_id, warehouse_id, donor_id)
      VALUES ('entrada', 'product', v_product_id, v_qty, v_unit_id, NULL, NULL,
              COALESCE(p_movement_note, 'Importación') || ' · Donante: ' || v_donor_name,
              p_center_id, v_warehouse_id, v_donor_id);
    END IF;

    v_ok := v_ok + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'createdCats', v_cats_created,
    'createdUnits', v_units_created,
    'productsCreated', v_products_created,
    'productsUpdated', v_products_updated,
    'donorMissing', v_skipped_donor,
    'warehouseMissing', v_skipped_warehouse
  );
END $$;
