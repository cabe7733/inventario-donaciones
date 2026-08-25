-- Donario v3: matriz de kits por bodega.
-- Misma idea que get_products_by_warehouse_matrix: una fila por
-- (bodega, kit) con stock calculado a partir de movements del centro.
-- Celdas con 0 NO se devuelven; el cliente rellena al armar la tabla.

DROP FUNCTION IF EXISTS public.get_kits_by_warehouse_matrix();

CREATE OR REPLACE FUNCTION public.get_kits_by_warehouse_matrix()
RETURNS TABLE (
  warehouse_id   UUID,
  warehouse_code TEXT,
  warehouse_name TEXT,
  kit_id         UUID,
  kit_name       TEXT,
  stock          NUMERIC
) AS $$
DECLARE
  v_center UUID;
BEGIN
  v_center := public.get_user_center_id();
  IF v_center IS NULL THEN RAISE EXCEPTION 'Sin centro activo'; END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.code,
    w.name,
    k.id,
    k.name,
    (COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)
      - COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'),  0))::NUMERIC AS stock
  FROM movements m
  JOIN warehouses w ON w.id = m.warehouse_id
  JOIN kits       k ON k.id = m.item_id AND m.item_type = 'kit'
  WHERE m.center_id = v_center
    AND m.deleted = false
    AND w.is_active = true
    AND k.is_active = true
  GROUP BY w.id, w.code, w.name, k.id, k.name
  HAVING (COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)
        - COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'),  0)) <> 0
  ORDER BY k.name, w.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
