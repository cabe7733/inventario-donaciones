-- Importación masiva de voluntarios desde CSV.

create or replace function import_volunteers_from_rows(
  p_rows jsonb,            -- [{full_name, phone, email, id_number, skills, availability}, ...]
  p_center_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  r jsonb;
  v_full_name text;
  v_phone text;
  v_email text;
  v_id_number text;
  v_skills text;
  v_availability text;
  v_skills_arr text[];
  v_ok int := 0;
  v_created int := 0;
  v_skipped int := 0;
  v_result jsonb;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_full_name := trim(r->>'full_name');
    v_phone := nullif(trim(coalesce(r->>'phone', '')), '');
    v_email := nullif(trim(coalesce(r->>'email', '')), '');
    v_id_number := nullif(trim(coalesce(r->>'id_number', '')), '');
    v_skills := nullif(trim(coalesce(r->>'skills', '')), '');
    v_availability := nullif(trim(coalesce(r->>'availability', '')), '');

    -- Convertir skills de string separado por coma a array
    if v_skills is not null then
      select array_agg(trim(s)) into v_skills_arr
      from unnest(string_to_array(v_skills, ',')) s
      where trim(s) <> '';
    else
      v_skills_arr := null;
    end if;

    -- Skip si ya existe un voluntario con el mismo nombre en el centro
    if exists (
      select 1 from volunteers
      where center_id = p_center_id
        and lower(full_name) = lower(v_full_name)
        and is_active = true
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into volunteers (center_id, full_name, phone, email, id_number, skills, availability, is_active)
    values (p_center_id, v_full_name, v_phone, v_email, v_id_number, v_skills_arr, v_availability, true);

    v_created := v_created + 1;
    v_ok := v_ok + 1;
  end loop;

  v_result := jsonb_build_object(
    'ok', v_ok,
    'created', v_created,
    'skipped', v_skipped
  );
  return v_result;
end $$;
