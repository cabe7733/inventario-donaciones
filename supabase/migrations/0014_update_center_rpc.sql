-- Donario v2: Editar el centro de acopio desde la app.
-- La policy "super_admin_full_access_centers" ya cubre ALL con super_admin,
-- pero centralizamos la lógica en una RPC SECURITY DEFINER para:
--   1. Validar el rol en un solo lugar
--   2. Mantener consistencia con `create_center`
--   3. No exponer columnas sensibles (slug) a updates accidentales
--
-- Si el centro no existe, devuelve false. Si OK, devuelve true.

create or replace function public.update_center(
  p_name text,
  p_address text,
  p_city text,
  p_state text,
  p_phone text,
  p_email text,
  p_entity_type text,
  p_entity_name text,
  p_entity_rfc text,
  p_representative_name text,
  p_representative_phone text,
  p_representative_email text
)
returns boolean
language plpgsql
security definer
as $$
declare
  center_id uuid;
  updated_count int;
begin
  if not public.is_super_admin() then
    raise exception 'Solo super_admin puede editar el centro';
  end if;

  center_id := public.get_user_center_id();
  if center_id is null then
    raise exception 'No tienes un centro activo';
  end if;

  update centers
  set
    name = p_name,
    address = p_address,
    city = p_city,
    state = p_state,
    phone = p_phone,
    email = p_email,
    entity_type = p_entity_type,
    entity_name = p_entity_name,
    entity_rfc = p_entity_rfc,
    representative_name = p_representative_name,
    representative_phone = p_representative_phone,
    representative_email = p_representative_email,
    updated_at = now()
  where id = center_id;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end $$;

-- Permitir que los miembros del centro editen su propio perfil (campos no sensibles).
-- El profile ya se crea automáticamente en handle_new_user(); esta policy permite
-- que el usuario mantenga first_name / last_name / phone actualizados.
drop policy if exists "users_can_update_own_profile_fields" on profiles;
create policy "users_can_update_own_profile_fields" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
