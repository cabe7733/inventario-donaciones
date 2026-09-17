-- Migration: Public inventory summary view & security (GIRAE style)
-- Exposes aggregated inventory urgency levels without revealing sensitive operational data

-- 1. Add umbral_minimo column to products if not exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS umbral_minimo NUMERIC DEFAULT 0;

-- 2. Create view public_inventario_resumen
CREATE OR REPLACE VIEW public_inventario_resumen AS
SELECT
  p.id AS product_id,
  c.id AS center_id,
  c.name AS center_name,
  COALESCE(cat.name, 'General') AS categoria,
  p.name AS nombre_producto,
  COALESCE(p.total_stock, 0) AS cantidad_actual,
  COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10) AS umbral_minimo,
  CASE
    WHEN COALESCE(p.total_stock, 0) = 0 THEN 'sin_existencias'
    WHEN p.total_stock <= (0.25 * COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)) THEN 'escaso'
    WHEN p.total_stock <= (0.75 * COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)) THEN 'regular'
    WHEN p.total_stock <= (1.50 * COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)) THEN 'abastecido'
    ELSE 'muy_abastecido'
  END AS nivel_urgencia,
  p.updated_at AS fecha_ultima_actualizacion
FROM products p
JOIN centers c ON c.id = p.center_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE p.is_active = true AND p.deleted = false AND c.is_active = true;

-- 3. Grant SELECT access to anon and authenticated roles
GRANT SELECT ON public_inventario_resumen TO anon, authenticated;

-- 4. RPC function to get public inventory summary for a center or all active centers
CREATE OR REPLACE FUNCTION get_public_inventario_resumen(p_center_id UUID DEFAULT NULL)
RETURNS TABLE (
  product_id UUID,
  center_id UUID,
  center_name TEXT,
  categoria TEXT,
  nombre_producto TEXT,
  cantidad_actual NUMERIC,
  umbral_minimo NUMERIC,
  nivel_urgencia TEXT,
  fecha_ultima_actualizacion TIMESTAMPTZ
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    pir.product_id,
    pir.center_id,
    pir.center_name,
    pir.categoria,
    pir.nombre_producto,
    pir.cantidad_actual,
    pir.umbral_minimo,
    pir.nivel_urgencia,
    pir.fecha_ultima_actualizacion
  FROM public_inventario_resumen pir
  WHERE (p_center_id IS NULL OR pir.center_id = p_center_id)
  ORDER BY
    CASE pir.nivel_urgencia
      WHEN 'sin_existencias' THEN 1
      WHEN 'escaso' THEN 2
      WHEN 'regular' THEN 3
      WHEN 'abastecido' THEN 4
      WHEN 'muy_abastecido' THEN 5
    END,
    pir.categoria,
    pir.nombre_producto;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_public_inventario_resumen(UUID) TO anon, authenticated;
