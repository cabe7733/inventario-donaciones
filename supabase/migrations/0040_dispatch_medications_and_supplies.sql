CREATE OR REPLACE FUNCTION public.dispatch_medical_prescription_v2(p_prescription_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center UUID := public.get_user_center_id();
  v_user UUID := auth.uid();
  v_prescription medical_prescriptions%ROWTYPE;
  v_item medical_prescription_items%ROWTYPE;
  v_med medications%ROWTYPE;
  v_med_lot medication_lots%ROWTYPE;
  v_supply medical_supplies%ROWTYPE;
  v_supply_lot medical_supply_lots%ROWTYPE;
  v_remaining NUMERIC;
  v_take NUMERIC;
BEGIN
  IF v_user IS NULL OR public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede despachar formulas';
  END IF;

  SELECT * INTO v_prescription FROM medical_prescriptions
  WHERE id = p_prescription_id AND center_id = v_center FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Formula no encontrada'; END IF;
  IF v_prescription.status <> 'draft' THEN RAISE EXCEPTION 'La formula ya no esta disponible'; END IF;

  IF EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id AND item_type = 'medication')
     AND NOT EXISTS (SELECT 1 FROM medication_exit_authorizers WHERE center_id = v_center AND user_id = v_user AND is_active) THEN
    RAISE EXCEPTION 'El usuario actual no esta asignado como autorizador de medicamentos';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id) THEN
    RAISE EXCEPTION 'La formula debe tener al menos un item';
  END IF;

  FOR v_item IN SELECT * FROM medical_prescription_items WHERE prescription_id = p_prescription_id ORDER BY created_at, id LOOP
    v_remaining := v_item.qty;

    IF v_item.item_type = 'medication' THEN
      SELECT * INTO v_med FROM medications WHERE id = v_item.item_id AND center_id = v_center AND is_active AND deleted = false FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Medicamento no encontrado'; END IF;
      FOR v_med_lot IN
        SELECT * FROM medication_lots
        WHERE medication_id = v_item.item_id AND center_id = v_center AND stock > 0 AND deleted = false
          AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
        ORDER BY fecha_vencimiento NULLS LAST, created_at, id FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_med_lot.stock, v_remaining);
        UPDATE medication_lots SET stock = stock - v_take, updated_at = now() WHERE id = v_med_lot.id;
        UPDATE medical_prescription_items SET lote_id = v_med_lot.id, medication_snapshot = jsonb_build_object('name', v_med.name, 'commercial_name', v_med.commercial_name, 'active_ingredient', v_med.active_ingredient, 'dosage', v_med.dosage, 'pharmaceutical_form', v_med.pharmaceutical_form, 'content', v_med.content, 'manufacturer', v_med.manufacturer, 'lot', v_med_lot.lote, 'expiry', v_med_lot.fecha_vencimiento) WHERE id = v_item.id;
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, fecha, operador_id, nota, center_id, warehouse_id, prescription_id, authorized_by, dispensed_by)
        VALUES ('salida', 'medication', v_med.id, v_take, v_med.unit_id, v_med_lot.id, now(), NULL, v_item.instructions, v_center, v_prescription.warehouse_id, p_prescription_id, v_user, v_user);
        v_remaining := v_remaining - v_take;
      END LOOP;
      IF v_remaining > 0 THEN RAISE EXCEPTION 'Stock insuficiente para el medicamento %', v_med.name; END IF;
    ELSE
      SELECT * INTO v_supply FROM medical_supplies WHERE id = v_item.item_id AND center_id = v_center AND is_active AND deleted = false FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Insumo medico no encontrado'; END IF;
      FOR v_supply_lot IN
        SELECT * FROM medical_supply_lots
        WHERE supply_id = v_item.item_id AND center_id = v_center AND stock > 0 AND deleted = false
          AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURRENT_DATE)
        ORDER BY fecha_vencimiento NULLS LAST, created_at, id FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_supply_lot.stock, v_remaining);
        UPDATE medical_supply_lots SET stock = stock - v_take, updated_at = now() WHERE id = v_supply_lot.id;
        UPDATE medical_prescription_items SET supply_snapshot = jsonb_build_object('name', v_supply.name, 'category', v_supply.category, 'lot', v_supply_lot.lote, 'expiry', v_supply_lot.fecha_vencimiento) WHERE id = v_item.id;
        INSERT INTO movements (kind, item_type, item_id, qty, unit_id, lote_id, medical_supply_lot_id, fecha, operador_id, nota, center_id, warehouse_id, prescription_id, authorized_by, dispensed_by)
        VALUES ('salida', 'medical_supply', v_supply.id, v_take, v_supply.unit_id, NULL, v_supply_lot.id, now(), NULL, v_item.instructions, v_center, v_prescription.warehouse_id, p_prescription_id, v_user, v_user);
        v_remaining := v_remaining - v_take;
      END LOOP;
      IF v_remaining > 0 THEN RAISE EXCEPTION 'Stock insuficiente para el insumo %', v_supply.name; END IF;
    END IF;
  END LOOP;

  UPDATE medical_prescriptions
  SET status = 'dispensed',
      medication_authorizer_user_id = CASE WHEN EXISTS (SELECT 1 FROM medical_prescription_items WHERE prescription_id = p_prescription_id AND item_type = 'medication') THEN v_user ELSE NULL END,
      dispensed_by = v_user,
      dispensed_at = now(),
      updated_at = now()
  WHERE id = p_prescription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_medical_prescription_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_medical_prescription_v2(UUID) TO authenticated;
