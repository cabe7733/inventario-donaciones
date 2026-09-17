-- Migration: Fix RPC functions sync_center_needs_from_inventory and sync_need_from_inventory
-- Adds SECURITY DEFINER, GRANT EXECUTE to authenticated and anon roles, and triggers schema cache reload.

CREATE OR REPLACE FUNCTION sync_need_from_inventory(p_need_id UUID)
RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  v_item_type TEXT;
  v_item_id UUID;
  v_current_stock NUMERIC := 0;
BEGIN
  SELECT item_type, item_id INTO v_item_type, v_item_id
  FROM center_needs WHERE id = p_need_id;

  -- Only sync if item_id is set
  IF v_item_id IS NULL THEN RETURN; END IF;

  IF v_item_type = 'product' THEN
    SELECT COALESCE(total_stock, 0) INTO v_current_stock
    FROM products WHERE id = v_item_id;
  ELSIF v_item_type = 'medication' THEN
    SELECT COALESCE(SUM(stock), 0) INTO v_current_stock
    FROM medication_lots WHERE medication_id = v_item_id AND NOT COALESCE(deleted, false);
  ELSIF v_item_type = 'medical_supply' THEN
    SELECT COALESCE(SUM(stock), 0) INTO v_current_stock
    FROM medical_supply_lots WHERE supply_id = v_item_id AND NOT COALESCE(deleted, false);
  END IF;

  UPDATE center_needs
  SET quantity_received = v_current_stock,
      status = CASE WHEN v_current_stock >= quantity_needed THEN 'fulfilled' ELSE 'active' END,
      updated_at = now()
  WHERE id = p_need_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_center_needs_from_inventory(p_center_id UUID)
RETURNS INTEGER SECURITY DEFINER AS $$
DECLARE
  v_need RECORD;
  v_updated INTEGER := 0;
BEGIN
  FOR v_need IN
    SELECT id FROM center_needs
    WHERE center_id = p_center_id AND status = 'active' AND item_id IS NOT NULL
  LOOP
    PERFORM sync_need_from_inventory(v_need.id);
    v_updated := v_updated + 1;
  END LOOP;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION sync_need_from_inventory(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION sync_center_needs_from_inventory(UUID) TO authenticated, anon, service_role;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
