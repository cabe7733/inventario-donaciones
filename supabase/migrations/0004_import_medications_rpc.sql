-- Importación masiva de medicamentos desde CSV.
-- 1 sola RPC = 1 round-trip a Supabase en vez de N por fila.
-- Idempotente: re-ejecutar con el mismo device_id + client_uuid no duplica nada.

create or replace function import_medications_from_rows(
  p_rows jsonb,            -- [{medication, category, qty, unit, presentation, lot, expiry, client_uuid}, ...]
  p_device_id text,
  p_movement_note text default 'Importación inicial',
  p_user_id uuid default null,
  p_center_id uuid default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  r jsonb;
  v_medication text;
  v_category text;
  v_unit text;
  v_qty numeric;
  v_presentation text;
  v_lot text;
  v_expiry text;
  v_client_uuid uuid;
  v_existing_cat record;
  v_existing_unit record;
  v_cat_id uuid;
  v_unit_id uuid;
  v_unit_client_uuid uuid;
  v_existing_med record;
  v_med_id uuid;
  v_med_client_uuid uuid;
  v_lot_id uuid;
  v_lot_client_uuid uuid;
  v_movement_client_uuid uuid;
  v_meds_created int := 0;
  v_meds_updated int := 0;
  v_cats_created int := 0;
  v_units_created int := 0;
  v_lots_created int := 0;
  v_ok int := 0;
  v_result jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_medication := r->>'medication';
    v_category := r->>'category';
    v_unit := coalesce(r->>'unit', 'Unidad');
    v_qty := coalesce((r->>'qty')::numeric, 0);
    v_presentation := coalesce(r->>'presentation', '');
    v_lot := r->>'lot';
    v_expiry := r->>'expiry';
    v_client_uuid := (r->>'client_uuid')::uuid;

    -- Categoría: lookup por nombre (case-insensitive) en scope medication, o crea una nueva.
    select id, client_uuid into v_existing_cat
    from categories
    where lower(name) = lower(v_category)
      and scope = 'medication'
      and deleted = false
    limit 1;

    if v_existing_cat.id is null then
      v_cat_id := gen_random_uuid();
      insert into categories (id, name, color, icon_key, "order", scope,
                              device_id, client_uuid, version, deleted)
      values (v_cat_id, v_category, 'primary-600', 'pills', 0, 'medication',
              p_device_id, gen_random_uuid(), 1, false);
      v_cats_created := v_cats_created + 1;
    else
      v_cat_id := v_existing_cat.id;
    end if;

    -- Unidad: lookup por nombre en scope medication.
    select id into v_existing_unit
    from units
    where lower(name) = lower(v_unit)
      and scope = 'medication'
      and deleted = false
    limit 1;

    if v_existing_unit.id is null then
      v_unit_id := gen_random_uuid();
      v_unit_client_uuid := gen_random_uuid();
      insert into units (id, name, abbreviation, scope,
                         device_id, client_uuid, version, deleted)
      values (v_unit_id, v_unit, lower(substring(v_unit, 1, 4)), 'medication',
              p_device_id, v_unit_client_uuid, 1, false);
      v_units_created := v_units_created + 1;
    else
      v_unit_id := v_existing_unit.id;
    end if;

    -- Medicamento: lookup por nombre. Si existe, actualiza categoría/unidad/presentación.
    select id into v_existing_med
    from medications
    where lower(name) = lower(v_medication)
      and deleted = false
    limit 1;

    v_med_client_uuid := coalesce(
      (select client_uuid from medications where id = v_existing_med.id),
      v_client_uuid
    );

    if v_existing_med.id is null then
      v_med_id := gen_random_uuid();
      insert into medications (id, name, presentacion, categoria_id, unit_id,
                               is_active, device_id, client_uuid, version, deleted)
      values (v_med_id, v_medication, v_presentation, v_cat_id, v_unit_id,
              true, p_device_id, v_client_uuid, 1, false);
      v_meds_created := v_meds_created + 1;
    else
      v_med_id := v_existing_med.id;
      update medications
        set categoria_id = v_cat_id,
            unit_id = v_unit_id,
            presentacion = v_presentation,
            version = version + 1
      where id = v_med_id;
      v_meds_updated := v_meds_updated + 1;
    end if;

    -- Lote: si se provee código de lote, crear/actualizar lote + movimiento.
    if v_lot is not null and v_lot <> '' then
      v_lot_client_uuid := gen_random_uuid();

      -- Buscar lote existente por código + medicamento
      select id into v_lot_id
      from medication_lots
      where medication_id = v_med_id
        and lote = v_lot
        and deleted = false
      limit 1;

      if v_lot_id is null then
        v_lot_id := gen_random_uuid();
        insert into medication_lots (id, medication_id, lote, fecha_vencimiento, stock,
                                     device_id, client_uuid, version, deleted)
        values (v_lot_id, v_med_id, v_lot,
                case when v_expiry <> '' then v_expiry::date else null end,
                v_qty, p_device_id, v_lot_client_uuid, 1, false);
        v_lots_created := v_lots_created + 1;
      else
        -- Actualizar stock del lote existente
        update medication_lots
          set stock = stock + v_qty,
              fecha_vencimiento = coalesce(
                case when v_expiry <> '' then v_expiry::date else null end,
                fecha_vencimiento
              ),
              version = version + 1
        where id = v_lot_id;
      end if;

      -- Registrar movimiento de entrada
      if v_qty > 0 then
        v_movement_client_uuid := gen_random_uuid();
        insert into movements (id, kind, item_type, item_id, qty, unit_id,
                               lote_id, operador_id, nota, center_id,
                               device_id, client_uuid, version, deleted)
        values (gen_random_uuid(), 'entrada', 'medication', v_med_id, v_qty,
                v_unit_id, v_lot_id, p_user_id, p_movement_note, p_center_id,
                p_device_id, v_movement_client_uuid, 1, false);
      end if;
    end if;

    v_ok := v_ok + 1;
  end loop;

  v_result := jsonb_build_object(
    'ok', v_ok,
    'createdCats', v_cats_created,
    'createdUnits', v_units_created,
    'medsCreated', v_meds_created,
    'medsUpdated', v_meds_updated,
    'lotsCreated', v_lots_created
  );
  return v_result;
end $$;
