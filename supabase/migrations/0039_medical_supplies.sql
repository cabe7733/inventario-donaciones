-- Insumos medicos independientes de products.

CREATE TABLE IF NOT EXISTS medical_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit_id UUID REFERENCES units(id),
  min_stock NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medical_supply_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES medical_supplies(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  lote TEXT NOT NULL DEFAULT 's/n',
  fecha_vencimiento DATE,
  stock NUMERIC NOT NULL DEFAULT 0 CHECK (stock >= 0),
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medical_supplies_center
  ON medical_supplies (center_id, name) WHERE deleted = false AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_medical_supply_lots_supply
  ON medical_supply_lots (supply_id, fecha_vencimiento) WHERE deleted = false;

ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_item_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_item_type_check
  CHECK (item_type IN ('product', 'medication', 'medical_supply', 'kit'));
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS medical_supply_lot_id UUID REFERENCES medical_supply_lots(id);

ALTER TABLE medical_prescription_items DROP CONSTRAINT IF EXISTS medical_prescription_items_item_type_check;
ALTER TABLE medical_prescription_items ADD CONSTRAINT medical_prescription_items_item_type_check
  CHECK (item_type IN ('medication', 'medical_supply', 'product'));

ALTER TABLE medical_prescription_items
  ADD COLUMN IF NOT EXISTS supply_snapshot JSONB;

DROP TRIGGER IF EXISTS trg_medical_supplies_updated_at ON medical_supplies;
CREATE TRIGGER trg_medical_supplies_updated_at
  BEFORE UPDATE ON medical_supplies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medical_supply_lots_updated_at ON medical_supply_lots;
CREATE TRIGGER trg_medical_supply_lots_updated_at
  BEFORE UPDATE ON medical_supply_lots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE medical_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_supply_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_read_medical_supplies" ON medical_supplies
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_manage_medical_supplies" ON medical_supplies
  FOR ALL USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_members_read_medical_supply_lots" ON medical_supply_lots
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_manage_medical_supply_lots" ON medical_supply_lots
  FOR ALL USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE OR REPLACE FUNCTION public.register_medical_supply_entry(
  p_supply_id UUID,
  p_lote TEXT,
  p_expiry DATE,
  p_qty NUMERIC,
  p_warehouse_id UUID,
  p_fecha TIMESTAMPTZ DEFAULT now(),
  p_nota TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_center UUID := public.get_user_center_id();
  v_supply medical_supplies%ROWTYPE;
  v_lot medical_supply_lots%ROWTYPE;
  v_lot_id UUID;
  v_unit UUID;
BEGIN
  IF public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar entradas';
  END IF;
  IF p_qty <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND center_id = v_center AND is_active) THEN
    RAISE EXCEPTION 'Bodega invalida';
  END IF;

  SELECT * INTO v_supply FROM medical_supplies
  WHERE id = p_supply_id AND center_id = v_center AND is_active AND deleted = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo medico no encontrado'; END IF;
  v_unit := v_supply.unit_id;

  SELECT * INTO v_lot FROM medical_supply_lots
  WHERE supply_id = p_supply_id AND center_id = v_center AND lote = COALESCE(NULLIF(trim(p_lote), ''), 's/n') AND deleted = false
  FOR UPDATE;
  IF FOUND THEN
    UPDATE medical_supply_lots SET stock = stock + p_qty, fecha_vencimiento = COALESCE(p_expiry, fecha_vencimiento), updated_at = now() WHERE id = v_lot.id;
    v_lot_id := v_lot.id;
  ELSE
    INSERT INTO medical_supply_lots (supply_id, center_id, lote, fecha_vencimiento, stock)
    VALUES (p_supply_id, v_center, COALESCE(NULLIF(trim(p_lote), ''), 's/n'), p_expiry, p_qty)
    RETURNING id INTO v_lot_id;
  END IF;

  INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, medical_supply_lot_id, fecha, operador_id, nota, center_id, warehouse_id)
  VALUES ('entrada', 'medical_supply', p_supply_id, p_qty, v_unit, NULL, v_lot_id, p_fecha, NULL, p_nota, v_center, p_warehouse_id)
  RETURNING id INTO v_lot_id;
  RETURN v_lot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_medical_supply_entry(UUID, TEXT, DATE, NUMERIC, UUID, TIMESTAMPTZ, TEXT) TO authenticated;
