-- La autorizacion de medicamentos se obtiene del usuario autenticado.
-- Se conserva la implementacion anterior para mantener el despacho atomico.

ALTER FUNCTION public.dispatch_medical_prescription(UUID)
  RENAME TO dispatch_medical_prescription_legacy;

CREATE OR REPLACE FUNCTION public.dispatch_medical_prescription(p_prescription_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_center UUID := public.get_user_center_id();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion para despachar medicamentos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM medical_prescription_items
    WHERE prescription_id = p_prescription_id AND item_type = 'medication'
  ) AND NOT EXISTS (
    SELECT 1 FROM medication_exit_authorizers
    WHERE center_id = v_center AND user_id = v_user AND is_active
  ) THEN
    RAISE EXCEPTION 'El usuario actual no esta asignado como autorizador de medicamentos';
  END IF;

  UPDATE medical_prescriptions
  SET medication_authorizer_user_id = CASE
    WHEN EXISTS (
      SELECT 1 FROM medical_prescription_items
      WHERE prescription_id = p_prescription_id AND item_type = 'medication'
    ) THEN v_user
    ELSE medication_authorizer_user_id
  END,
  updated_at = now()
  WHERE id = p_prescription_id AND center_id = v_center AND status = 'draft';

  PERFORM public.dispatch_medical_prescription_legacy(p_prescription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_medical_prescription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_medical_prescription(UUID) TO authenticated;
