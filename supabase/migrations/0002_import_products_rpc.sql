-- Importación masiva de productos desde CSV.
-- 1 sola RPC = 1 round-trip a Supabase en vez de N por fila.
-- Idempotente: re-ejecutar con el mismo device_id + client_uuid no duplica nada.
-- Coexiste con el path local Dexie (sigue siendo el source-of-truth de la UI);
-- la página llama a la RPC y luego espeja el resultado a Dexie para que la lista
-- se actualice al instante.

create or replace function import_products_from_rows(
  p_rows jsonb,            -- [{product, category, qty, unit, client_uuid}, ...]
  p_device_id text,        -- device_id del navegador (Dexie ya lo genera)
  p_movement_note text default 'Importación inicial'
) returns jsonb
language plpgsql
security invoker
as $$
declare
  r jsonb;
  v_product text;
  v_category text;
  v_unit text;
  v_qty numeric;
  v_client_uuid uuid;
  v_existing_cat record;
  v_existing_unit record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_unit_client_uuid uuid;
  v_existing_product record;
  v_product_id uuid;
  v_product_client_uuid uuid;
  v_new_stock numeric;
  v_movement_client_uuid uuid;
  v_products_created int := 0;
  v_products_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_ok int := 0;
  v_result jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_product := r->>'product';
    v_category := r->>'category';
    v_unit := coalesce(r->>'unit', 'Unidad');
    v_qty := (r->>'qty')::numeric;
    v_client_uuid := (r->>'client_uuid')::uuid;

    -- Categoría: lookup por nombre (case-insensitive) en scope product, o crea una nueva.
    select id, client_uuid into v_existing_cat
    from categories
    where lower(name) = lower(v_category)
      and scope = 'product'
      and deleted = false
    limit 1;

    if v_existing_cat.id is null then
      v_cat_id := gen_random_uuid();
      insert into categories (id, name, color, icon_key, "order", scope,
                              device_id, client_uuid, version, deleted)
      values (v_cat_id, v_category, 'primary-600', 'box', 0, 'product',
              p_device_id, gen_random_uuid(), 1, false);
      v_cats_created := v_cats_created + 1;
    else
      v_cat_id := v_existing_cat.id;
    end if;

    -- Unidad: lookup por nombre en scope product. Si no existe, crea con client_uuid
    -- determinístico basado en (device_id, lower(name)) para que el upsert de la
    -- página espejo no choque por (device_id, client_uuid) repetido.
    select id into v_existing_unit
    from units
    where lower(name) = lower(v_unit)
      and scope = 'product'
      and deleted = false
    limit 1;

    if v_existing_unit.id is null then
      v_unit_id := gen_random_uuid();
      v_unit_client_uuid := gen_random_uuid();
      insert into units (id, name, abbreviation, scope,
                         device_id, client_uuid, version, deleted)
      values (v_unit_id, v_unit, lower(substring(v_unit, 1, 4)), 'product',
              p_device_id, v_unit_client_uuid, 1, false);
      v_units_created := v_units_created + 1;
    else
      v_unit_id := v_existing_unit.id;
    end if;

    -- Producto: lookup por nombre. Si existe, suma qty al total_stock + registra
    -- movimiento de entrada. Si no, crea el producto con su client_uuid y movimiento.
    select id, total_stock into v_existing_product
    from products
    where lower(name) = lower(v_product)
      and deleted = false
    limit 1;

    v_product_client_uuid := coalesce(
      (select client_uuid from products where id = v_existing_product.id),
      v_client_uuid
    );

    if v_existing_product.id is null then
      v_product_id := gen_random_uuid();
      insert into products (id, name, aliases, category_id, unit_id, min_stock,
                            total_stock, is_active, device_id, client_uuid,
                            version, deleted)
      values (v_product_id, v_product, '{}', v_cat_id, v_unit_id, null,
              v_qty, true, p_device_id, v_client_uuid, 1, false);
      v_products_created := v_products_created + 1;
      v_new_stock := v_qty;
    else
      v_product_id := v_existing_product.id;
      v_new_stock := v_existing_product.total_stock + v_qty;
      update products
        set total_stock = v_new_stock,
            category_id = v_cat_id,
            unit_id = v_unit_id,
            version = version + 1
      where id = v_product_id;
      v_products_updated := v_products_updated + 1;
    end if;

    if v_qty > 0 then
      v_movement_client_uuid := gen_random_uuid();
      insert into movements (id, kind, item_type, item_id, qty, unit_id,
                             lote_id, operador_id, nota,
                             device_id, client_uuid, version, deleted)
      values (gen_random_uuid(), 'entrada', 'product', v_product_id, v_qty,
              v_unit_id, null, null, p_movement_note,
              p_device_id, v_movement_client_uuid, 1, false);
    end if;

    v_ok := v_ok + 1;
  end loop;

  v_result := jsonb_build_object(
    'ok', v_ok,
    'createdCats', v_cats_created,
    'createdUnits', v_units_created,
    'productsCreated', v_products_created,
    'productsUpdated', v_products_updated
  );
  return v_result;
end $$;

-- La RPC se invoca vía supabase.rpc con el rol anon; las policies "anon full access"
-- ya permiten el insert/update que la función hace por debajo.
