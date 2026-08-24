-- Donario v3: RPCs para el módulo de informes.
-- - get_warehouse_donations_report: cada movement con donante/receptor.
-- - get_general_report: stock + entradas/salidas agregadas cross-bodega.
-- - get_products_by_warehouse_matrix: pares (bodega, producto, stock).

-- ================= 1) DONACIONES POR BODEGA =================
-- Devuelve cada movimiento de la bodega con donante (entradas) y receptor (salidas).
-- Filtros opcionales por fecha y por tipo (entrada/salida).

DROP FUNCTION IF EXISTS public.get_warehouse_donations_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.get_warehouse_donations_report(
  p_warehouse_id UUID,
  p_from         TIMESTAMPTZ DEFAULT NULL,
  p_to           TIMESTAMPTZ DEFAULT NULL,
  p_kind         TEXT        DEFAULT NULL  -- 'entrada' | 'salida' | NULL
)
RETURNS TABLE (
  movement_id    UUID,
  fecha          TIMESTAMPTZ,
  kind           TEXT,
  item_type      TEXT,
  item_id        UUID,
  item_name      TEXT,
  qty            NUMERIC,
  donor_name     TEXT,
  recipient_name TEXT,
  nota           TEXT
) AS $$
DECLARE
  v_center UUID;
BEGIN
  SELECT w.center_id INTO v_center FROM warehouses w WHERE w.id = p_warehouse_id;
  IF v_center IS NULL OR v_center <> public.get_user_center_id() THEN
    RAISE EXCEPTION 'Bodega no encontrada';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.fecha,
    m.kind,
    m.item_type,
    m.item_id,
    COALESCE(p.name, md.name, k.name, m.item_id::text) AS item_name,
    m.qty,
    d.full_name  AS donor_name,
    r.full_name  AS recipient_name,
    m.nota
  FROM movements m
  LEFT JOIN products    p  ON m.item_type = 'product'    AND p.id  = m.item_id
  LEFT JOIN medications md ON m.item_type = 'medication' AND md.id = m.item_id
  LEFT JOIN kits        k  ON m.item_type = 'kit'        AND k.id  = m.item_id
  LEFT JOIN donors      d  ON d.id  = m.donor_id
  LEFT JOIN recipients  r  ON r.id  = m.recipient_id
  WHERE m.warehouse_id = p_warehouse_id
    AND m.deleted = false
    AND (p_kind IS NULL OR m.kind = p_kind)
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <= p_to)
  ORDER BY m.fecha DESC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================= 2) INFORME GENERAL (CROSS-BODEGA) =================
-- Una fila por (item_type, item_id) sumando TODAS las bodegas del centro.

DROP FUNCTION IF EXISTS public.get_general_report(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_general_report(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  item_type     TEXT,
  item_id       UUID,
  item_name     TEXT,
  total_in      NUMERIC,
  total_out     NUMERIC,
  current_stock NUMERIC,
  warehouse_count INT
) AS $$
DECLARE
  v_center UUID;
BEGIN
  v_center := public.get_user_center_id();
  IF v_center IS NULL THEN RAISE EXCEPTION 'Sin centro activo'; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT
      m.item_type,
      m.item_id,
      COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)::NUMERIC AS total_in,
      COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'),  0)::NUMERIC AS total_out,
      COUNT(DISTINCT m.warehouse_id)::INT AS warehouse_count
    FROM movements m
    WHERE m.center_id = v_center
      AND m.deleted = false
      AND (p_from IS NULL OR m.fecha >= p_from)
      AND (p_to   IS NULL OR m.fecha <= p_to)
    GROUP BY m.item_type, m.item_id
  )
  SELECT
    a.item_type,
    a.item_id,
    COALESCE(p.name, md.name, k.name, a.item_id::text) AS item_name,
    a.total_in,
    a.total_out,
    (a.total_in - a.total_out)::NUMERIC AS current_stock,
    a.warehouse_count
  FROM agg a
  LEFT JOIN products    p  ON a.item_type = 'product'    AND p.id  = a.item_id
  LEFT JOIN medications md ON a.item_type = 'medication' AND md.id = a.item_id
  LEFT JOIN kits        k  ON a.item_type = 'kit'        AND k.id  = a.item_id
  ORDER BY item_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================= 3) PRODUCTOS × BODEGA (MATRIZ) =================
-- Devuelve stock por (bodega, producto) sumando movements del centro.
-- Celdas con 0 NO se devuelven: el cliente rellena huecos al armar la matriz.

DROP FUNCTION IF EXISTS public.get_products_by_warehouse_matrix();

CREATE OR REPLACE FUNCTION public.get_products_by_warehouse_matrix()
RETURNS TABLE (
  warehouse_id   UUID,
  warehouse_code TEXT,
  warehouse_name TEXT,
  product_id     UUID,
  product_name   TEXT,
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
    p.id,
    p.name,
    (COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)
      - COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'),  0))::NUMERIC AS stock
  FROM movements m
  JOIN warehouses w ON w.id = m.warehouse_id
  JOIN products   p ON p.id = m.item_id AND m.item_type = 'product'
  WHERE m.center_id = v_center
    AND m.deleted = false
    AND w.is_active = true
    AND p.is_active = true
  GROUP BY w.id, w.code, w.name, p.id, p.name
  HAVING (COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'entrada'), 0)
        - COALESCE(SUM(m.qty) FILTER (WHERE m.kind = 'salida'),  0)) <> 0
  ORDER BY w.name, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
