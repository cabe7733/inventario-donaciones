-- Donario: formulas medicas, inventario farmaceutico detallado y autorizadores.

ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS commercial_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS active_ingredient TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dosage TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS excipients TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pharmaceutical_form TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manufacturer TEXT NOT NULL DEFAULT '';

ALTER FUNCTION public.import_medications_from_rows(jsonb, text, uuid, uuid)
  RENAME TO import_medications_from_rows_legacy;

CREATE OR REPLACE FUNCTION public.import_medications_from_rows(
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
  v_result jsonb;
BEGIN
  v_result := public.import_medications_from_rows_legacy(p_rows, p_movement_note, p_user_id, p_center_id);
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    UPDATE medications
    SET commercial_name = COALESCE(NULLIF(r->>'commercial_name', ''), commercial_name),
        active_ingredient = COALESCE(NULLIF(r->>'active_ingredient', ''), active_ingredient),
        dosage = COALESCE(NULLIF(r->>'dosage', ''), dosage),
        excipients = COALESCE(NULLIF(r->>'excipients', ''), excipients),
        pharmaceutical_form = COALESCE(NULLIF(r->>'pharmaceutical_form', ''), pharmaceutical_form),
        content = COALESCE(NULLIF(r->>'content', ''), content),
        manufacturer = COALESCE(NULLIF(r->>'manufacturer', ''), manufacturer),
        updated_at = now()
    WHERE center_id = p_center_id
      AND lower(name) = lower(COALESCE(r->>'medication', ''))
      AND deleted = false;
  END LOOP;
  RETURN v_result;
END;
$$;

UPDATE medications
SET commercial_name = COALESCE(NULLIF(commercial_name, ''), name),
    pharmaceutical_form = COALESCE(NULLIF(pharmaceutical_form, ''), presentacion)
WHERE commercial_name = '' OR pharmaceutical_form = '';

CREATE TABLE IF NOT EXISTS inventory_exit_authorizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_number TEXT,
  role TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_exit_authorizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_exit_authorizers_center
  ON inventory_exit_authorizers (center_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_medication_exit_authorizers_center
  ON medication_exit_authorizers (center_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS medical_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  patient_type TEXT NOT NULL CHECK (patient_type IN ('person', 'health_center')),
  patient_first_name TEXT,
  patient_last_name TEXT,
  patient_document_number TEXT,
  patient_birth_date DATE,
  patient_sex TEXT,
  patient_phone TEXT,
  health_center_name TEXT,
  health_center_document TEXT,
  health_center_contact TEXT,
  health_center_phone TEXT,
  health_center_address TEXT,
  doctor_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  inventory_authorizer_id UUID REFERENCES inventory_exit_authorizers(id),
  medication_authorizer_user_id UUID REFERENCES auth.users(id),
  dispensed_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dispensed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispensed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medical_prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES medical_prescriptions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('medication', 'product')),
  item_id UUID NOT NULL,
  lote_id UUID REFERENCES medication_lots(id),
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_id UUID REFERENCES units(id),
  instructions TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  medication_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_prescriptions_center
  ON medical_prescriptions (center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_prescriptions_status
  ON medical_prescriptions (center_id, status);
CREATE INDEX IF NOT EXISTS idx_medical_prescription_items_prescription
  ON medical_prescription_items (prescription_id);

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES medical_prescriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS authorized_inventory_by UUID REFERENCES inventory_exit_authorizers(id),
  ADD COLUMN IF NOT EXISTS dispensed_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_movements_prescription
  ON movements (prescription_id) WHERE prescription_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_inventory_exit_authorizers_updated_at ON inventory_exit_authorizers;
CREATE TRIGGER trg_inventory_exit_authorizers_updated_at
  BEFORE UPDATE ON inventory_exit_authorizers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medication_exit_authorizers_updated_at ON medication_exit_authorizers;
CREATE TRIGGER trg_medication_exit_authorizers_updated_at
  BEFORE UPDATE ON medication_exit_authorizers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medical_prescriptions_updated_at ON medical_prescriptions;
CREATE TRIGGER trg_medical_prescriptions_updated_at
  BEFORE UPDATE ON medical_prescriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_three_exit_authorizers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.is_active THEN
    IF TG_TABLE_NAME = 'inventory_exit_authorizers' THEN
      SELECT COUNT(*) INTO v_count FROM inventory_exit_authorizers
      WHERE center_id = NEW.center_id AND is_active AND id <> NEW.id;
    ELSE
      SELECT COUNT(*) INTO v_count FROM medication_exit_authorizers
      WHERE center_id = NEW.center_id AND is_active AND id <> NEW.id;
    END IF;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Un centro no puede tener mas de tres autorizadores activos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_three_inventory_exit_authorizers ON inventory_exit_authorizers;
CREATE TRIGGER trg_three_inventory_exit_authorizers
  BEFORE INSERT OR UPDATE ON inventory_exit_authorizers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_three_exit_authorizers();

DROP TRIGGER IF EXISTS trg_three_medication_exit_authorizers ON medication_exit_authorizers;
CREATE TRIGGER trg_three_medication_exit_authorizers
  BEFORE INSERT OR UPDATE ON medication_exit_authorizers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_three_exit_authorizers();

ALTER TABLE inventory_exit_authorizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_exit_authorizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_read_inventory_exit_authorizers" ON inventory_exit_authorizers
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_manage_inventory_exit_authorizers" ON inventory_exit_authorizers
  FOR ALL USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_members_read_medication_exit_authorizers" ON medication_exit_authorizers
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_manage_medication_exit_authorizers" ON medication_exit_authorizers
  FOR ALL USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
    AND EXISTS (
      SELECT 1 FROM center_members cm
      WHERE cm.center_id = medication_exit_authorizers.center_id AND cm.user_id = medication_exit_authorizers.user_id AND cm.is_active
    )
  );

CREATE POLICY "center_members_read_medical_prescriptions" ON medical_prescriptions
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_insert_medical_prescriptions" ON medical_prescriptions
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
    AND created_by = auth.uid()
  );
CREATE POLICY "center_admins_update_draft_medical_prescriptions" ON medical_prescriptions
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND status = 'draft'
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (center_id = public.get_user_center_id());

CREATE POLICY "center_members_read_medical_prescription_items" ON medical_prescription_items
  FOR SELECT USING (
    prescription_id IN (SELECT id FROM medical_prescriptions WHERE center_id = public.get_user_center_id())
  );
CREATE POLICY "center_admins_manage_draft_medical_prescription_items" ON medical_prescription_items
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM medical_prescriptions
      WHERE center_id = public.get_user_center_id()
        AND status = 'draft'
        AND public.get_user_role() IN ('super_admin', 'admin')
    )
  ) WITH CHECK (
    prescription_id IN (
      SELECT id FROM medical_prescriptions
      WHERE center_id = public.get_user_center_id() AND status = 'draft'
    )
  );

CREATE OR REPLACE FUNCTION public.dispatch_medical_prescription(p_prescription_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center UUID;
  v_user UUID;
  v_role TEXT;
  v_prescription medical_prescriptions%ROWTYPE;
  v_item medical_prescription_items%ROWTYPE;
  v_lot medication_lots%ROWTYPE;
  v_med medications%ROWTYPE;
  v_product products%ROWTYPE;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_authorizer_count INTEGER;
  v_snapshot JSONB;
BEGIN
  v_user := auth.uid();
  v_center := public.get_user_center_id();
  v_role := public.get_user_role();

  IF v_user IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede despachar formulas';
  END IF;

  SELECT * INTO v_prescription
  FROM medical_prescriptions
  WHERE id = p_prescription_id AND center_id = v_center
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Formula no encontrada'; END IF;
  IF v_prescription.status <> 'draft' THEN RAISE EXCEPTION 'La formula ya no esta disponible'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM center_members WHERE center_id = v_center AND user_id = v_prescription.doctor_user_id AND is_active
  ) THEN RAISE EXCEPTION 'El medico no pertenece al centro'; END IF;

  IF v_prescription.inventory_authorizer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM inventory_exit_authorizers
      WHERE id = v_prescription.inventory_authorizer_id AND center_id = v_center AND is_active
    ) THEN RAISE EXCEPTION 'Autorizador de inventario invalido'; END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id) THEN
    RAISE EXCEPTION 'La formula debe tener al menos un item';
  END IF;

  IF EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id AND item_type = 'medication')
     AND NOT EXISTS (
       SELECT 1 FROM medication_exit_authorizers mea
       WHERE mea.center_id = v_center AND mea.user_id = v_user AND mea.is_active
     ) THEN
    RAISE EXCEPTION 'El usuario actual no esta asignado como autorizador de medicamentos';
  END IF;

  FOR v_item IN SELECT * FROM medical_prescription_items WHERE prescription_id = p_prescription_id ORDER BY created_at, id LOOP
    IF v_item.item_type = 'product' THEN
      SELECT * INTO v_product FROM products WHERE id = v_item.item_id AND center_id = v_center FOR UPDATE;
      IF NOT FOUND OR NOT v_product.is_active OR v_product.total_stock < v_item.qty THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto';
      END IF;
      UPDATE products SET total_stock = total_stock - v_item.qty, updated_at = now() WHERE id = v_product.id;
      INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, fecha, operador_id, nota, center_id, warehouse_id, prescription_id, authorized_inventory_by, dispensed_by)
      VALUES ('salida', 'product', v_product.id, v_item.qty, v_item.unit_id, NULL, now(), NULL, v_item.notes, v_center, v_prescription.warehouse_id, p_prescription_id, v_prescription.inventory_authorizer_id, v_user);
    ELSE
      SELECT * INTO v_med FROM medications WHERE id = v_item.item_id AND center_id = v_center AND deleted = false FOR UPDATE;
      IF NOT FOUND OR NOT v_med.is_active THEN RAISE EXCEPTION 'Medicamento invalido'; END IF;
      v_remaining := v_item.qty;
      FOR v_lot IN
        SELECT * FROM medication_lots
        WHERE medication_id = v_item.item_id AND center_id = v_center AND deleted = false AND stock > 0
          AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
        ORDER BY fecha_vencimiento NULLS LAST, created_at, id
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_lot.stock, v_remaining);
        UPDATE medication_lots SET stock = stock - v_take, updated_at = now() WHERE id = v_lot.id;
        v_snapshot := jsonb_build_object('name', v_med.name, 'commercial_name', v_med.commercial_name, 'active_ingredient', v_med.active_ingredient, 'dosage', v_med.dosage, 'pharmaceutical_form', v_med.pharmaceutical_form, 'content', v_med.content, 'manufacturer', v_med.manufacturer, 'lot', v_lot.lote, 'expiry', v_lot.fecha_vencimiento);
        UPDATE medical_prescription_items SET medication_snapshot = v_snapshot, lote_id = v_lot.id WHERE id = v_item.id;
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, fecha, operador_id, nota, center_id, warehouse_id, prescription_id, authorized_by, dispensed_by)
        VALUES ('salida', 'medication', v_med.id, v_take, v_med.unit_id, v_lot.id, now(), NULL, v_item.instructions, v_center, v_prescription.warehouse_id, p_prescription_id, v_user, v_user);
        v_remaining := v_remaining - v_take;
      END LOOP;
      IF v_remaining > 0 THEN RAISE EXCEPTION 'Stock insuficiente para el medicamento %', v_med.name; END IF;
    END IF;
  END LOOP;

  UPDATE medical_prescriptions
  SET status = 'dispensed', medication_authorizer_user_id = CASE WHEN EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id AND item_type = 'medication') THEN v_user ELSE medication_authorizer_user_id END, dispensed_by = v_user, dispensed_at = now(), updated_at = now()
  WHERE id = p_prescription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_medical_prescription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_medical_prescription(UUID) TO authenticated;
