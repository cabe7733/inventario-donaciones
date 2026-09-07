ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inventory_authorizer_id UUID REFERENCES inventory_exit_authorizers(id);

CREATE INDEX IF NOT EXISTS idx_orders_inventory_authorizer
  ON orders (inventory_authorizer_id)
  WHERE inventory_authorizer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_order_with_authorizer(
  p_warehouse_id UUID,
  p_items JSONB,
  p_recipient_id UUID,
  p_inventory_authorizer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_center UUID := public.get_user_center_id();
  v_order_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM inventory_exit_authorizers
    WHERE id = p_inventory_authorizer_id AND center_id = v_center AND is_active
  ) THEN
    RAISE EXCEPTION 'Autorizador de inventario invalido';
  END IF;

  v_order_id := public.create_order(
    p_order_type := 'salida',
    p_warehouse_id := p_warehouse_id,
    p_items := p_items,
    p_recipient_id := p_recipient_id
  );

  UPDATE orders
  SET inventory_authorizer_id = p_inventory_authorizer_id
  WHERE id = v_order_id AND center_id = v_center;

  UPDATE movements
  SET authorized_inventory_by = p_inventory_authorizer_id
  WHERE order_id = v_order_id AND center_id = v_center;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_authorizer(UUID, JSONB, UUID, UUID) TO authenticated;
