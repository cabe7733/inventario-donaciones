-- Migration: Fix public views security definer, permissions & threshold logic
-- Fixes empty results for anon role when querying public centers, needs & inventory summary

-- 1. Recreate public_inventory_needs view without restrictive min_stock > 0 filter
CREATE OR REPLACE VIEW public_inventory_needs AS
-- Products out of stock (total_stock = 0)
SELECT
  p.center_id,
  'product'::text AS item_type,
  p.id AS item_id,
  p.name AS title,
  'Sin existencias en inventario'::text AS description,
  COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)::numeric AS quantity_needed,
  COALESCE(p.total_stock, 0)::numeric AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  p.updated_at
FROM products p
WHERE COALESCE(p.is_active, true) = true 
  AND COALESCE(p.deleted, false) = false
  AND COALESCE(p.total_stock, 0) = 0

UNION ALL

-- Products with low stock (total_stock <= threshold)
SELECT
  p.center_id,
  'product'::text AS item_type,
  p.id AS item_id,
  p.name AS title,
  'Stock por debajo del mínimo'::text AS description,
  COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)::numeric AS quantity_needed,
  COALESCE(p.total_stock, 0)::numeric AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  p.updated_at
FROM products p
WHERE COALESCE(p.is_active, true) = true 
  AND COALESCE(p.deleted, false) = false
  AND p.total_stock > 0
  AND p.total_stock <= COALESCE(NULLIF(p.umbral_minimo, 0), NULLIF(p.min_stock, 0), 10)

UNION ALL

-- Medications with zero stock
SELECT
  m.center_id,
  'medication'::text AS item_type,
  m.id AS item_id,
  m.name AS title,
  COALESCE(NULLIF(m.active_ingredient, ''), '') ||
    CASE WHEN m.pharmaceutical_form IS NOT NULL AND m.pharmaceutical_form != ''
      THEN ' - ' || m.pharmaceutical_form ELSE '' END AS description,
  10::numeric AS quantity_needed,
  COALESCE(SUM(ml.stock), 0)::numeric AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  m.updated_at
FROM medications m
LEFT JOIN medication_lots ml ON ml.medication_id = m.id AND NOT COALESCE(ml.deleted, false)
WHERE COALESCE(m.is_active, true) = true AND NOT COALESCE(m.deleted, false)
GROUP BY m.id, m.center_id, m.name, m.active_ingredient, m.pharmaceutical_form, m.updated_at
HAVING COALESCE(SUM(ml.stock), 0) = 0

UNION ALL

-- Medications with low stock
SELECT
  m.center_id,
  'medication'::text AS item_type,
  m.id AS item_id,
  m.name AS title,
  COALESCE(NULLIF(m.active_ingredient, ''), '') ||
    CASE WHEN m.pharmaceutical_form IS NOT NULL AND m.pharmaceutical_form != ''
      THEN ' - ' || m.pharmaceutical_form ELSE '' END AS description,
  10::numeric AS quantity_needed,
  COALESCE(SUM(ml.stock), 0)::numeric AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  m.updated_at
FROM medications m
LEFT JOIN medication_lots ml ON ml.medication_id = m.id AND NOT COALESCE(ml.deleted, false)
WHERE COALESCE(m.is_active, true) = true AND NOT COALESCE(m.deleted, false)
GROUP BY m.id, m.center_id, m.name, m.active_ingredient, m.pharmaceutical_form, m.updated_at
HAVING COALESCE(SUM(ml.stock), 0) > 0 AND COALESCE(SUM(ml.stock), 0) < 10

UNION ALL

-- Medical supplies with zero stock
SELECT
  ms.center_id,
  'medical_supply'::text AS item_type,
  ms.id AS item_id,
  ms.name AS title,
  COALESCE(NULLIF(ms.category, ''), 'Insumo médico')::text AS description,
  10::numeric AS quantity_needed,
  COALESCE(SUM(msl.stock), 0)::numeric AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  ms.updated_at
FROM medical_supplies ms
LEFT JOIN medical_supply_lots msl ON msl.supply_id = ms.id AND NOT COALESCE(msl.deleted, false)
WHERE COALESCE(ms.is_active, true) = true AND NOT COALESCE(ms.deleted, false)
GROUP BY ms.id, ms.center_id, ms.name, ms.category, ms.updated_at
HAVING COALESCE(SUM(msl.stock), 0) = 0

UNION ALL

-- Medical supplies with low stock
SELECT
  ms.center_id,
  'medical_supply'::text AS item_type,
  ms.id AS item_id,
  ms.name AS title,
  COALESCE(NULLIF(ms.category, ''), 'Insumo médico')::text AS description,
  10::numeric AS quantity_needed,
  COALESCE(SUM(msl.stock), 0)::numeric AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  ms.updated_at
FROM medical_supplies ms
LEFT JOIN medical_supply_lots msl ON msl.supply_id = ms.id AND NOT COALESCE(msl.deleted, false)
WHERE COALESCE(ms.is_active, true) = true AND NOT COALESCE(ms.deleted, false)
GROUP BY ms.id, ms.center_id, ms.name, ms.category, ms.updated_at
HAVING COALESCE(SUM(msl.stock), 0) > 0 AND COALESCE(SUM(msl.stock), 0) < 10;

-- 2. Recreate public_center_details view with COALESCE(c.is_active, true)
CREATE OR REPLACE VIEW public_center_details AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.description AS public_description,
  c.address,
  c.city,
  c.state,
  c.phone AS public_phone,
  c.email AS public_email,
  c.operating_hours,
  COALESCE(c.accepts_donations, true) AS accepts_donations,
  c.created_at,
  c.updated_at,
  (SELECT COUNT(*) FROM products p WHERE p.center_id = c.id AND COALESCE(p.is_active, true) AND NOT COALESCE(p.deleted, false)) AS total_products,
  (SELECT COUNT(*) FROM medications m WHERE m.center_id = c.id AND COALESCE(m.is_active, true) AND NOT COALESCE(m.deleted, false)) AS total_medications,
  (SELECT COUNT(*) FROM volunteers v WHERE v.center_id = c.id AND COALESCE(v.is_active, true)) AS total_volunteers,
  (SELECT COUNT(*) FROM center_needs cn WHERE cn.center_id = c.id AND cn.status = 'active') AS total_needs
FROM centers c
WHERE COALESCE(c.is_active, true) = true;

-- 3. Recreate RPC functions with SECURITY DEFINER so they execute bypassing table RLS
CREATE OR REPLACE FUNCTION get_public_centers()
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, public_description TEXT,
  address TEXT, city TEXT, state TEXT,
  public_phone TEXT, public_email TEXT, operating_hours TEXT,
  accepts_donations BOOLEAN,
  total_products BIGINT, total_medications BIGINT, total_volunteers BIGINT, total_needs BIGINT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM public_center_details ORDER BY name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_public_center_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, public_description TEXT,
  address TEXT, city TEXT, state TEXT,
  public_phone TEXT, public_email TEXT, operating_hours TEXT,
  accepts_donations BOOLEAN,
  total_products BIGINT, total_medications BIGINT, total_volunteers BIGINT, total_needs BIGINT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM public_center_details pcd WHERE pcd.slug = p_slug;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_public_needs(p_center_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  center_id UUID,
  center_name TEXT,
  center_city TEXT,
  center_state TEXT,
  center_slug TEXT,
  item_type TEXT,
  title TEXT,
  description TEXT,
  quantity_needed NUMERIC,
  quantity_received NUMERIC,
  quantity_remaining NUMERIC,
  priority TEXT,
  stock_level TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  -- Derived needs from inventory
  SELECT
    gen_random_uuid() AS id,
    pin.center_id,
    c.name AS center_name,
    c.city AS center_city,
    c.state AS center_state,
    c.slug AS center_slug,
    pin.item_type,
    pin.title,
    pin.description,
    pin.quantity_needed,
    pin.quantity_received,
    GREATEST(0, pin.quantity_needed - pin.quantity_received) AS quantity_remaining,
    pin.priority,
    CASE
      WHEN pin.quantity_needed = 0 THEN 'available'
      WHEN (pin.quantity_received::float / NULLIF(pin.quantity_needed, 0)) >= 1.0 THEN 'sufficient'
      WHEN (pin.quantity_received::float / NULLIF(pin.quantity_needed, 0)) >= 0.6 THEN 'moderate'
      WHEN (pin.quantity_received::float / NULLIF(pin.quantity_needed, 0)) >= 0.2 THEN 'low'
      ELSE 'critical'
    END AS stock_level,
    pin.source,
    pin.updated_at AS created_at,
    pin.updated_at
  FROM public_inventory_needs pin
  JOIN centers c ON c.id = pin.center_id
  WHERE COALESCE(c.is_active, true) = true AND (p_center_id IS NULL OR pin.center_id = p_center_id)

  UNION ALL

  -- Manual needs from center_needs
  SELECT
    cn.id,
    cn.center_id,
    c.name AS center_name,
    c.city AS center_city,
    c.state AS center_state,
    c.slug AS center_slug,
    cn.item_type,
    cn.title,
    cn.description,
    cn.quantity_needed,
    cn.quantity_received,
    GREATEST(0, cn.quantity_needed - cn.quantity_received) AS quantity_remaining,
    cn.priority,
    CASE
      WHEN cn.quantity_needed = 0 THEN 'available'
      WHEN (cn.quantity_received::float / NULLIF(cn.quantity_needed, 0)) >= 1.0 THEN 'sufficient'
      WHEN (cn.quantity_received::float / NULLIF(cn.quantity_needed, 0)) >= 0.6 THEN 'moderate'
      WHEN (cn.quantity_received::float / NULLIF(cn.quantity_needed, 0)) >= 0.2 THEN 'low'
      ELSE 'critical'
    END AS stock_level,
    cn.source,
    cn.created_at,
    cn.updated_at
  FROM center_needs cn
  JOIN centers c ON c.id = cn.center_id
  WHERE cn.status = 'active' AND COALESCE(c.is_active, true) = true
    AND (p_center_id IS NULL OR cn.center_id = p_center_id)

  ORDER BY
    CASE priority
      WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
    END,
    updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Explicit GRANTs to anon and authenticated
GRANT SELECT ON public_center_details TO anon, authenticated;
GRANT SELECT ON public_inventory_needs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_centers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_center_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_needs(UUID) TO anon, authenticated;
