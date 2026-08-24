-- Donario v3: Donantes y beneficiarios como entidades
-- Las órdenes referencian donor_id / recipient_id; los campos inline
-- (donor_full_name, recipient_full_name, ...) quedan para datos legacy.

-- ================= DONANTES =================

CREATE TABLE IF NOT EXISTS donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('person', 'entity')),
  full_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donors_center ON donors (center_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS donors_center_doc_uniq
  ON donors (center_id, id_number) WHERE id_number IS NOT NULL AND is_active = true;

DROP TRIGGER IF EXISTS trg_set_updated_at ON donors;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON donors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE donors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_donors" ON donors
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_donors" ON donors
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_donors" ON donors
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_donors" ON donors
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= BENEFICIARIOS =================

CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'person' CHECK (kind IN ('person', 'entity')),
  full_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipients_center ON recipients (center_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS recipients_center_doc_uniq
  ON recipients (center_id, id_number) WHERE id_number IS NOT NULL AND is_active = true;

DROP TRIGGER IF EXISTS trg_set_updated_at ON recipients;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON recipients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_recipients" ON recipients
  FOR SELECT USING (center_id = public.get_user_center_id());

CREATE POLICY "center_admins_can_insert_recipients" ON recipients
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_admins_can_update_recipients" ON recipients
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "super_admin_can_delete_recipients" ON recipients
  FOR DELETE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() = 'super_admin'
  );

-- ================= ÓRDENES REFERENCIAN ENTIDADES =================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS donor_id UUID REFERENCES donors(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES recipients(id);

-- ================= RPC: CREATE ORDER CON DONANTE/BENEFICIARIO =================

DROP FUNCTION IF EXISTS public.create_order(TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

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
