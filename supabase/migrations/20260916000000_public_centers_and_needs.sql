-- Migration: Public centers and needs (hybrid: derived + manual)
-- Adds public-facing fields to centers + needs table for public viewing

-- 1. Add public-facing columns to centers
ALTER TABLE centers ADD COLUMN IF NOT EXISTS operating_hours TEXT;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS accepts_donations BOOLEAN DEFAULT true;

-- 2. Create needs table (manual needs created by centers)
CREATE TABLE IF NOT EXISTS center_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('product','medication','medical_supply')),
  item_id UUID, -- nullable for manual needs without a specific inventory item
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  quantity_needed NUMERIC DEFAULT 0,
  quantity_received NUMERIC DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','cancelled')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('inventory','manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_center_needs_center_id ON center_needs(center_id);
CREATE INDEX IF NOT EXISTS idx_center_needs_status ON center_needs(status);
CREATE INDEX IF NOT EXISTS idx_center_needs_priority ON center_needs(priority);
CREATE INDEX IF NOT EXISTS idx_centers_is_active ON centers(is_active);

-- 4. RLS: Public read access for active centers
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_active_centers" ON centers;
CREATE POLICY "public_read_active_centers" ON centers
  FOR SELECT USING (is_active = true);

-- 5. RLS: Public read access for active needs
ALTER TABLE center_needs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_active_needs" ON center_needs;
DROP POLICY IF EXISTS "authenticated_manage_needs" ON center_needs;
CREATE POLICY "public_read_active_needs" ON center_needs
  FOR SELECT USING (status = 'active');
CREATE POLICY "authenticated_manage_needs" ON center_needs
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND center_id = public.get_user_center_id()
  );

-- 6. View: needs DERIVED from inventory (automatic, no manual entry needed)
CREATE OR REPLACE VIEW public_inventory_needs AS
-- Products out of stock
SELECT
  p.center_id,
  'product'::text AS item_type,
  p.id AS item_id,
  p.name AS title,
  'Sin existencias en inventario'::text AS description,
  COALESCE(p.min_stock, 0) AS quantity_needed,
  p.total_stock AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  p.updated_at
FROM products p
WHERE p.is_active AND NOT p.deleted
  AND p.total_stock = 0
  AND p.min_stock IS NOT NULL AND p.min_stock > 0

UNION ALL

-- Products with low stock
SELECT
  p.center_id,
  'product'::text AS item_type,
  p.id AS item_id,
  p.name AS title,
  'Stock por debajo del mínimo'::text AS description,
  COALESCE(p.min_stock, 0) AS quantity_needed,
  p.total_stock AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  p.updated_at
FROM products p
WHERE p.is_active AND NOT p.deleted
  AND p.total_stock > 0
  AND p.min_stock IS NOT NULL AND p.total_stock <= p.min_stock

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
  COALESCE(SUM(ml.stock), 0) AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  m.updated_at
FROM medications m
LEFT JOIN medication_lots ml ON ml.medication_id = m.id AND NOT ml.deleted
WHERE m.is_active AND NOT m.deleted
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
  COALESCE(SUM(ml.stock), 0) AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  m.updated_at
FROM medications m
LEFT JOIN medication_lots ml ON ml.medication_id = m.id AND NOT ml.deleted
WHERE m.is_active AND NOT m.deleted
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
  COALESCE(SUM(msl.stock), 0) AS quantity_received,
  'urgent'::text AS priority,
  'inventory'::text AS source,
  ms.updated_at
FROM medical_supplies ms
LEFT JOIN medical_supply_lots msl ON msl.supply_id = ms.id AND NOT msl.deleted
WHERE ms.is_active AND NOT ms.deleted
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
  COALESCE(SUM(msl.stock), 0) AS quantity_received,
  'high'::text AS priority,
  'inventory'::text AS source,
  ms.updated_at
FROM medical_supplies ms
LEFT JOIN medical_supply_lots msl ON msl.supply_id = ms.id AND NOT msl.deleted
WHERE ms.is_active AND NOT ms.deleted
GROUP BY ms.id, ms.center_id, ms.name, ms.category, ms.updated_at
HAVING COALESCE(SUM(msl.stock), 0) > 0 AND COALESCE(SUM(msl.stock), 0) < 10;

-- 7. View: public center details with inventory counts
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
  c.accepts_donations,
  c.created_at,
  c.updated_at,
  (SELECT COUNT(*) FROM products p WHERE p.center_id = c.id AND p.is_active AND NOT p.deleted) AS total_products,
  (SELECT COUNT(*) FROM medications m WHERE m.center_id = c.id AND m.is_active AND NOT m.deleted) AS total_medications,
  (SELECT COUNT(*) FROM volunteers v WHERE v.center_id = c.id AND v.is_active) AS total_volunteers,
  -- Count of active manual needs
  (SELECT COUNT(*) FROM center_needs cn WHERE cn.center_id = c.id AND cn.status = 'active') AS total_needs
FROM centers c
WHERE c.is_active = true;

-- 8. RPC: Get all public centers
CREATE OR REPLACE FUNCTION get_public_centers()
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, public_description TEXT,
  address TEXT, city TEXT, state TEXT,
  public_phone TEXT, public_email TEXT, operating_hours TEXT,
  accepts_donations BOOLEAN,
  total_products BIGINT, total_medications BIGINT, total_volunteers BIGINT, total_needs BIGINT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM public_center_details ORDER BY name;
END;
$$ LANGUAGE plpgsql;

-- 9. RPC: Get public center by slug
CREATE OR REPLACE FUNCTION get_public_center_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID, name TEXT, slug TEXT, public_description TEXT,
  address TEXT, city TEXT, state TEXT,
  public_phone TEXT, public_email TEXT, operating_hours TEXT,
  accepts_donations BOOLEAN,
  total_products BIGINT, total_medications BIGINT, total_volunteers BIGINT, total_needs BIGINT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM public_center_details pcd WHERE pcd.slug = p_slug;
END;
$$ LANGUAGE plpgsql;

-- 10. RPC: Get combined needs (derived + manual) for a center or all centers
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
) AS $$
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
  WHERE c.is_active AND (p_center_id IS NULL OR pin.center_id = p_center_id)

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
  WHERE cn.status = 'active' AND c.is_active
    AND (p_center_id IS NULL OR cn.center_id = p_center_id)

  ORDER BY
    CASE priority
      WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4
    END,
    updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 11. RPC: Sync a single need's quantity_received from inventory
CREATE OR REPLACE FUNCTION sync_need_from_inventory(p_need_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item_type TEXT;
  v_item_id UUID;
  v_current_stock NUMERIC := 0;
BEGIN
  SELECT item_type, item_id INTO v_item_type, v_item_id
  FROM center_needs WHERE id = p_need_id;

  -- Only sync if item_id is set (manual needs may not have one)
  IF v_item_id IS NULL THEN RETURN; END IF;

  IF v_item_type = 'product' THEN
    SELECT COALESCE(total_stock, 0) INTO v_current_stock
    FROM products WHERE id = v_item_id;
  ELSIF v_item_type = 'medication' THEN
    SELECT COALESCE(SUM(stock), 0) INTO v_current_stock
    FROM medication_lots WHERE medication_id = v_item_id AND NOT deleted;
  ELSIF v_item_type = 'medical_supply' THEN
    SELECT COALESCE(SUM(stock), 0) INTO v_current_stock
    FROM medical_supply_lots WHERE supply_id = v_item_id AND NOT deleted;
  END IF;

  UPDATE center_needs
  SET quantity_received = v_current_stock,
      status = CASE WHEN v_current_stock >= quantity_needed THEN 'fulfilled' ELSE 'active' END,
      updated_at = now()
  WHERE id = p_need_id;
END;
$$ LANGUAGE plpgsql;

-- 12. RPC: Sync all manual needs for a center from inventory
CREATE OR REPLACE FUNCTION sync_center_needs_from_inventory(p_center_id UUID)
RETURNS INTEGER AS $$
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
