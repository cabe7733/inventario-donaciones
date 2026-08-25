-- Donario v3: Edición/eliminación de órdenes restringida al super admin.
--
-- Cambios:
--   1. orders.deleted (soft-delete).
--   2. movements.order_id (nullable, FK a orders) — para que replace_order /
--      delete_order puedan revertir stock de forma trazable.
--   3. RLS de orders/order_items/movements para UPDATE/DELETE → super_admin only.
--   4. create_order ahora escribe order_id en cada movement que crea.
--   5. RPCs replace_order y delete_order (solo super_admin).

-- ================= 1. SCHEMA =================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_center_active
  ON orders (center_id, created_at DESC) WHERE deleted = false;

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movements_order
  ON movements (order_id) WHERE order_id IS NOT NULL;

-- ponytail: trigger updated_at para orders (no tenía trigger en 0008).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at' AND tgrelid = 'orders'::regclass
  ) THEN
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ================= 2. RLS: SUPER_ADMIN ONLY PARA UPDATE/DELETE =================

-- orders: SELECT sigue siendo para todos los miembros del centro.
-- INSERT sigue siendo super_admin + admin.
-- UPDATE/DELETE pasan a super_admin only.

DROP POLICY IF EXISTS "center_admins_can_update_orders" ON orders;
CREATE POLICY "super_admin_can_update_orders" ON orders
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "super_admin_can_delete_orders" ON orders;
CREATE POLICY "super_admin_can_delete_orders" ON orders
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- order_items: agregar policies de UPDATE/DELETE super_admin only.

DROP POLICY IF EXISTS "super_admin_can_update_order_items" ON order_items;
CREATE POLICY "super_admin_can_update_order_items" ON order_items
  FOR UPDATE USING (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "super_admin_can_delete_order_items" ON order_items;
CREATE POLICY "super_admin_can_delete_order_items" ON order_items
  FOR DELETE USING (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
    AND public.get_user_role() = 'super_admin'
  );

-- movements: agregar UPDATE/DELETE super_admin only (no existían).

DROP POLICY IF EXISTS "super_admin_can_update_movements" ON movements;
CREATE POLICY "super_admin_can_update_movements" ON movements
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "super_admin_can_delete_movements" ON movements;
CREATE POLICY "super_admin_can_delete_movements" ON movements
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= 3. create_order: ahora escribe order_id en movements =================

DROP FUNCTION IF EXISTS public.create_order(
  TEXT, UUID, JSONB,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  UUID, UUID
);

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
  p_notes TEXT DEFAULT '',
  p_donor_id UUID DEFAULT NULL,
  p_recipient_id UUID DEFAULT NULL
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

  IF NOT EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = p_warehouse_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bodega inválida o inactiva';
  END IF;

  IF p_donor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM donors WHERE id = p_donor_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Donante inválido';
  END IF;

  IF p_recipient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM recipients WHERE id = p_recipient_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Beneficiario inválido';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un item a la orden';
  END IF;

  INSERT INTO orders (
    center_id, warehouse_id, order_type,
    donor_id, recipient_id,
    donor_full_name, donor_id_number, donor_phone, donor_email,
    donor_entity_name, donor_entity_rfc,
    vehicle_plate, vehicle_type, vehicle_color,
    recipient_full_name, recipient_id_number, recipient_phone, recipient_email,
    recipient_entity_name, recipient_entity_rfc, recipient_type,
    created_by, notes
  ) VALUES (
    center, p_warehouse_id, p_order_type,
    p_donor_id, p_recipient_id,
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

    INSERT INTO movements (
      kind, item_type, item_id, qty, unit_id, lote_id, fecha,
      operador_id, nota, center_id, warehouse_id, donor_id, recipient_id, order_id
    )
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
      p_warehouse_id,
      p_donor_id,
      p_recipient_id,
      new_order_id
    );
  END LOOP;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= 4. RPC: reverse_order_stock =================
-- Helper interno: revierte el efecto en stock de los movements de una orden
-- (sin tocarlos). Llamado desde replace_order y delete_order.
-- SECURITY DEFINER para bypassear RLS de movements/products.

DROP FUNCTION IF EXISTS public.reverse_order_stock(UUID);

CREATE OR REPLACE FUNCTION public.reverse_order_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT item_type, item_id, lote_id, kind, qty
    FROM movements
    WHERE order_id = p_order_id AND deleted = false
  LOOP
    IF m.item_type = 'product' THEN
      IF m.kind = 'entrada' THEN
        UPDATE products SET total_stock = total_stock - m.qty WHERE id = m.item_id;
      ELSE
        UPDATE products SET total_stock = total_stock + m.qty WHERE id = m.item_id;
      END IF;
    ELSIF m.item_type = 'medication' AND m.lote_id IS NOT NULL THEN
      IF m.kind = 'entrada' THEN
        UPDATE medication_lots SET stock = stock - m.qty WHERE id = m.lote_id;
      ELSE
        UPDATE medication_lots SET stock = stock + m.qty WHERE id = m.lote_id;
      END IF;
    ELSIF m.item_type = 'kit' THEN
      IF m.kind = 'entrada' THEN
        UPDATE kits SET total_stock = total_stock - m.qty WHERE id = m.item_id;
      ELSE
        UPDATE kits SET total_stock = total_stock + m.qty WHERE id = m.item_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= 5. RPC: apply_order_stock =================
-- Aplica el delta de stock para una lista de items en una bodega.
-- Validación de stock suficiente para salidas.

DROP FUNCTION IF EXISTS public.apply_order_items_stock(
  TEXT, UUID, JSONB
);

CREATE OR REPLACE FUNCTION public.apply_order_items_stock(
  p_order_type TEXT,
  p_warehouse_id UUID,
  p_items JSONB
)
RETURNS VOID AS $$
DECLARE
  item JSONB;
  item_type TEXT;
  item_id UUID;
  item_qty NUMERIC;
  lote_id UUID;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_type := (item->>'item_type')::TEXT;
    item_id := (item->>'item_id')::UUID;
    item_qty := (item->>'qty')::NUMERIC;
    lote_id := (item->>'lote_id')::UUID;

    IF item_type = 'product' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE products SET total_stock = total_stock + item_qty WHERE id = item_id;
      ELSE
        IF (SELECT total_stock FROM products WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el producto %', item_id;
        END IF;
        UPDATE products SET total_stock = total_stock - item_qty WHERE id = item_id;
      END IF;

    ELSIF item_type = 'medication' AND lote_id IS NOT NULL THEN
      IF p_order_type = 'entrada' THEN
        UPDATE medication_lots SET stock = stock + item_qty WHERE id = lote_id;
      ELSE
        IF (SELECT stock FROM medication_lots WHERE id = lote_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el lote %', lote_id;
        END IF;
        UPDATE medication_lots SET stock = stock - item_qty WHERE id = lote_id;
      END IF;

    ELSIF item_type = 'kit' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE kits SET total_stock = total_stock + item_qty WHERE id = item_id;
      ELSE
        IF (SELECT total_stock FROM kits WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el kit %', item_id;
        END IF;
        UPDATE kits SET total_stock = total_stock - item_qty WHERE id = item_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= 6. RPC: replace_order =================
-- Reemplaza items/donante/bodega/notas de una orden. Revierte stock previo
-- y aplica el nuevo. Mantiene mismo order_id, created_by, created_at.
-- Solo super_admin.

DROP FUNCTION IF EXISTS public.replace_order(
  UUID, UUID, JSONB,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  UUID, UUID
);

CREATE OR REPLACE FUNCTION public.replace_order(
  p_order_id UUID,
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
  p_notes TEXT DEFAULT '',
  p_donor_id UUID DEFAULT NULL,
  p_recipient_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  center UUID;
  user_role TEXT;
  v_order_type TEXT;
  item JSONB;
  item_type TEXT;
  item_id UUID;
  item_qty NUMERIC;
  lote_id UUID;
BEGIN
  center := public.get_user_center_id();
  user_role := public.get_user_role();

  IF user_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo el super admin puede editar órdenes';
  END IF;

  SELECT order_type INTO v_order_type
  FROM orders
  WHERE id = p_order_id AND center_id = center AND deleted = false;

  IF v_order_type IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses
    WHERE id = p_warehouse_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bodega inválida o inactiva';
  END IF;

  IF p_donor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM donors WHERE id = p_donor_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Donante inválido';
  END IF;

  IF p_recipient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM recipients WHERE id = p_recipient_id AND center_id = center AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Beneficiario inválido';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un item a la orden';
  END IF;

  -- 1. Revertir stock de los movements anteriores.
  PERFORM public.reverse_order_stock(p_order_id);

  -- 2. Marcar movements y order_items anteriores como deleted.
  UPDATE movements SET deleted = true, updated_at = now()
  WHERE order_id = p_order_id AND deleted = false;

  DELETE FROM order_items WHERE order_id = p_order_id;

  -- 3. Actualizar cabecera de la orden.
  UPDATE orders SET
    warehouse_id = p_warehouse_id,
    donor_id = p_donor_id,
    recipient_id = p_recipient_id,
    donor_full_name = p_donor_full_name,
    donor_id_number = p_donor_id_number,
    donor_phone = p_donor_phone,
    donor_email = p_donor_email,
    donor_entity_name = p_donor_entity_name,
    donor_entity_rfc = p_donor_entity_rfc,
    vehicle_plate = p_vehicle_plate,
    vehicle_type = p_vehicle_type,
    vehicle_color = p_vehicle_color,
    recipient_full_name = p_recipient_full_name,
    recipient_id_number = p_recipient_id_number,
    recipient_phone = p_recipient_phone,
    recipient_email = p_recipient_email,
    recipient_entity_name = p_recipient_entity_name,
    recipient_entity_rfc = p_recipient_entity_rfc,
    recipient_type = p_recipient_type,
    notes = p_notes,
    updated_at = now()
  WHERE id = p_order_id;

  -- 4. Insertar nuevos items + movements + aplicar stock.
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_type := (item->>'item_type')::TEXT;
    item_id := (item->>'item_id')::UUID;
    item_qty := (item->>'qty')::NUMERIC;
    lote_id := (item->>'lote_id')::UUID;

    INSERT INTO order_items (order_id, item_type, item_id, qty, unit_id, lote_id, notes)
    VALUES (
      p_order_id,
      item_type,
      item_id,
      item_qty,
      (item->>'unit_id')::UUID,
      lote_id,
      COALESCE((item->>'notes')::TEXT, '')
    );

    INSERT INTO movements (
      kind, item_type, item_id, qty, unit_id, lote_id, fecha,
      operador_id, nota, center_id, warehouse_id, donor_id, recipient_id, order_id
    )
    VALUES (
      v_order_type,
      item_type,
      item_id,
      item_qty,
      (item->>'unit_id')::UUID,
      lote_id,
      now(),
      NULL,
      COALESCE((item->>'notes')::TEXT, ''),
      center,
      p_warehouse_id,
      p_donor_id,
      p_recipient_id,
      p_order_id
    );
  END LOOP;

  PERFORM public.apply_order_items_stock(v_order_type, p_warehouse_id, p_items);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= 7. RPC: delete_order =================
-- Soft-delete: marca la orden y movements como deleted, revierte stock.
-- Solo super_admin.

DROP FUNCTION IF EXISTS public.delete_order(UUID);

CREATE OR REPLACE FUNCTION public.delete_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  center UUID;
  user_role TEXT;
BEGIN
  center := public.get_user_center_id();
  user_role := public.get_user_role();

  IF user_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Solo el super admin puede eliminar órdenes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id AND center_id = center AND deleted = false
  ) THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  -- 1. Revertir stock.
  PERFORM public.reverse_order_stock(p_order_id);

  -- 2. Marcar movements y orden como deleted.
  UPDATE movements SET deleted = true, updated_at = now()
  WHERE order_id = p_order_id AND deleted = false;

  UPDATE orders SET deleted = true, updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================= 8. fetch_orders: filtrar deleted =================
-- Update la SELECT de orders en la app para excluir deleted.
-- El código de cliente ya hace .eq('deleted', false) en algunas queries,
-- pero el fetch principal (fetchOrders) no. Por defensa, lo añadimos en
-- la vista / función para órdenes activas.

DROP FUNCTION IF EXISTS public.get_orders_for_center(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_orders_for_center(
  p_order_type TEXT DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  center_id UUID,
  warehouse_id UUID,
  order_type TEXT,
  donor_id UUID,
  recipient_id UUID,
  donor_full_name TEXT,
  donor_id_number TEXT,
  donor_phone TEXT,
  donor_email TEXT,
  donor_entity_name TEXT,
  donor_entity_rfc TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  vehicle_color TEXT,
  recipient_full_name TEXT,
  recipient_id_number TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_entity_name TEXT,
  recipient_entity_rfc TEXT,
  recipient_type TEXT,
  created_by UUID,
  order_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted BOOLEAN
) AS $$
DECLARE
  v_center UUID;
BEGIN
  v_center := public.get_user_center_id();
  IF v_center IS NULL THEN RAISE EXCEPTION 'Sin centro activo'; END IF;

  RETURN QUERY
  SELECT
    o.id, o.center_id, o.warehouse_id, o.order_type,
    o.donor_id, o.recipient_id,
    o.donor_full_name, o.donor_id_number, o.donor_phone, o.donor_email,
    o.donor_entity_name, o.donor_entity_rfc,
    o.vehicle_plate, o.vehicle_type, o.vehicle_color,
    o.recipient_full_name, o.recipient_id_number, o.recipient_phone, o.recipient_email,
    o.recipient_entity_name, o.recipient_entity_rfc, o.recipient_type,
    o.created_by, o.order_date, o.notes, o.created_at, o.updated_at, o.deleted
  FROM orders o
  WHERE o.center_id = v_center
    AND o.deleted = false
    AND (p_order_type IS NULL OR o.order_type = p_order_type)
    AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
