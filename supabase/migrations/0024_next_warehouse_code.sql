-- Donario v3: Genera el siguiente código de bodega "BOD-NN" para un centro.
-- Encuentra el máximo NN usado en codes BOD-NN del centro, retorna BOD-{NN+1}
-- con padding a 2 dígitos. Idempotente en lectura (solo SELECT).

CREATE OR REPLACE FUNCTION public.next_warehouse_code(p_center_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_max INT := 0;
  v_next TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN code ~ '^BOD-[0-9]+$' THEN substring(code FROM 5)::INT ELSE 0 END
  ), 0)
  INTO v_max
  FROM warehouses
  WHERE center_id = p_center_id;

  v_next := 'BOD-' || lpad((v_max + 1)::TEXT, 2, '0');
  RETURN v_next;
END $$;

-- RPC auxiliar: reactiva una bodega (toggle de is_active).
-- Las policies RLS ya filtran por centro + rol admin/super_admin.
CREATE OR REPLACE FUNCTION public.toggle_warehouse_active(p_warehouse_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE warehouses SET is_active = p_active, updated_at = now()
  WHERE id = p_warehouse_id;
END $$;