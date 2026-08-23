-- Donario v2: Voluntarios y Órdenes de entrada/salida
-- Fase 3: Tablas nuevas para voluntarios y órdenes tipo pedido

-- ================= VOLUNTARIOS =================

CREATE TABLE IF NOT EXISTS volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_number TEXT,
  skills TEXT[],
  availability TEXT,         -- 'tiempo completo', 'fines de semana', 'flexible'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteers_center ON volunteers (center_id) WHERE is_active = true;

ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_volunteers" ON volunteers
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_volunteers" ON volunteers
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_volunteers" ON volunteers
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_volunteers" ON volunteers
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= ÓRDENES DE ENTRADA/SALIDA =================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('entrada', 'salida')),

  -- Datos del donante (solo entradas)
  donor_full_name TEXT,
  donor_id_number TEXT,
  donor_phone TEXT,
  donor_email TEXT,
  donor_entity_name TEXT,
  donor_entity_rfc TEXT,

  -- Datos del vehículo (solo entradas, opcional)
  vehicle_plate TEXT,
  vehicle_type TEXT,
  vehicle_color TEXT,

  -- Datos del destinatario (solo salidas)
  recipient_full_name TEXT,
  recipient_id_number TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_entity_name TEXT,
  recipient_entity_rfc TEXT,
  recipient_type TEXT CHECK (recipient_type IN ('person', 'entity')),

  -- Trazabilidad
  created_by UUID NOT NULL REFERENCES auth.users(id),
  order_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_center ON orders (center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders (created_by);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_orders" ON orders
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_orders" ON orders
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

-- ================= ITEMS DE ÓRDENES =================

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'medication', 'kit')),
  item_id UUID NOT NULL,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_id UUID REFERENCES units(id),
  lote_id UUID REFERENCES medication_lots(id),
  notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_order_items" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE center_id = public.get_user_center_id())
  );

-- ================= RPC: CREAR ORDEN CON MÚLTIPLES ITEMS =================

CREATE OR REPLACE FUNCTION public.create_order(
  p_order_type TEXT,
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

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un item a la orden';
  END IF;

  -- Crear la orden
  INSERT INTO orders (
    center_id, order_type,
    donor_full_name, donor_id_number, donor_phone, donor_email,
    donor_entity_name, donor_entity_rfc,
    vehicle_plate, vehicle_type, vehicle_color,
    recipient_full_name, recipient_id_number, recipient_phone, recipient_email,
    recipient_entity_name, recipient_entity_rfc, recipient_type,
    created_by, notes
  ) VALUES (
    center, p_order_type,
    p_donor_full_name, p_donor_id_number, p_donor_phone, p_donor_email,
    p_donor_entity_name, p_donor_entity_rfc,
    p_vehicle_plate, p_vehicle_type, p_vehicle_color,
    p_recipient_full_name, p_recipient_id_number, p_recipient_phone, p_recipient_email,
    p_recipient_entity_name, p_recipient_entity_rfc, p_recipient_type,
    auth.uid(), p_notes
  ) RETURNING id INTO new_order_id;

  -- Insertar items y actualizar stock
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    item_type := (item->>'item_type')::TEXT;
    item_id := (item->>'item_id')::UUID;
    item_qty := (item->>'qty')::NUMERIC;
    lote_id := (item->>'lote_id')::UUID;

    -- Insertar item
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

    -- Actualizar stock según tipo
    IF item_type = 'product' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE products SET total_stock = total_stock + item_qty, version = version + 1
        WHERE id = item_id;
      ELSE
        -- Validar stock suficiente para salidas
        IF (SELECT total_stock FROM products WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el producto %', item_id;
        END IF;
        UPDATE products SET total_stock = total_stock - item_qty, version = version + 1
        WHERE id = item_id;
      END IF;

    ELSIF item_type = 'medication' AND lote_id IS NOT NULL THEN
      IF p_order_type = 'entrada' THEN
        UPDATE medication_lots SET stock = stock + item_qty, version = version + 1
        WHERE id = lote_id;
      ELSE
        IF (SELECT stock FROM medication_lots WHERE id = lote_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el lote %', lote_id;
        END IF;
        UPDATE medication_lots SET stock = stock - item_qty, version = version + 1
        WHERE id = lote_id;
      END IF;

    ELSIF item_type = 'kit' THEN
      IF p_order_type = 'entrada' THEN
        UPDATE kits SET total_stock = total_stock + item_qty, version = version + 1
        WHERE id = item_id;
      ELSE
        IF (SELECT total_stock FROM kits WHERE id = item_id) < item_qty THEN
          RAISE EXCEPTION 'Stock insuficiente para el kit %', item_id;
        END IF;
        UPDATE kits SET total_stock = total_stock - item_qty, version = version + 1
        WHERE id = item_id;
      END IF;
    END IF;

    -- Registrar movimiento en tabla movements (trazabilidad granular)
    INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, fecha, operador_id, nota, center_id)
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
      center
    );
  END LOOP;

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
