CREATE TABLE IF NOT EXISTS public.comedor_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  apellido TEXT,
  celular TEXT,
  numero_documento TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comedor_people_center_active
  ON public.comedor_people (center_id, is_active);
CREATE INDEX IF NOT EXISTS idx_comedor_people_name
  ON public.comedor_people (center_id, nombre, apellido);
CREATE UNIQUE INDEX IF NOT EXISTS comedor_people_center_doc_uniq
  ON public.comedor_people (center_id, numero_documento)
  WHERE numero_documento IS NOT NULL AND btrim(numero_documento) <> '' AND is_active = true;

DROP TRIGGER IF EXISTS trg_comedor_people_updated_at ON public.comedor_people;
CREATE TRIGGER trg_comedor_people_updated_at
  BEFORE UPDATE ON public.comedor_people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.comedor_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.comedor_people(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_comedor_visits_center_date
  ON public.comedor_visits (center_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_comedor_visits_person_date
  ON public.comedor_visits (person_id, visit_date DESC);

ALTER TABLE public.comedor_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comedor_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_can_read_comedor_people" ON public.comedor_people
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_can_insert_comedor_people" ON public.comedor_people
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );
CREATE POLICY "center_admins_can_update_comedor_people" ON public.comedor_people
  FOR UPDATE USING (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  ) WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
  );

CREATE POLICY "center_members_can_read_comedor_visits" ON public.comedor_visits
  FOR SELECT USING (center_id = public.get_user_center_id());
CREATE POLICY "center_admins_can_insert_comedor_visits" ON public.comedor_visits
  FOR INSERT WITH CHECK (
    center_id = public.get_user_center_id()
    AND public.get_user_role() IN ('super_admin', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.comedor_people p
      WHERE p.id = person_id AND p.center_id = public.get_user_center_id() AND p.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.import_comedor_rows(p_rows JSONB, p_center_id UUID)
RETURNS JSONB AS $$
DECLARE
  row_data JSONB;
  person_id UUID;
  created_count INTEGER := 0;
  visit_count INTEGER := 0;
  skipped_count INTEGER := 0;
  row_date DATE;
  row_name TEXT;
  row_last_name TEXT;
  row_phone TEXT;
  row_document TEXT;
  row_date_text TEXT;
BEGIN
  IF p_center_id <> public.get_user_center_id()
     OR public.get_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'No tienes permiso para importar asistentes';
  END IF;

  FOR row_data IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) LOOP
    row_name := btrim(COALESCE(row_data->>'nombre', ''));
    row_last_name := NULLIF(btrim(COALESCE(row_data->>'apellido', '')), '');
    row_phone := NULLIF(btrim(COALESCE(row_data->>'celular', '')), '');
    row_document := NULLIF(btrim(COALESCE(row_data->>'numero_documento', '')), '');
    row_date_text := NULLIF(btrim(COALESCE(row_data->>'fecha', '')), '');

    IF row_name = '' OR row_date_text IS NULL OR row_date_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;
    row_date := row_date_text::DATE;

    SELECT id INTO person_id
    FROM public.comedor_people
    WHERE center_id = p_center_id AND is_active = true
      AND ((row_document IS NOT NULL AND numero_documento = row_document)
        OR (row_document IS NULL AND lower(nombre) = lower(row_name)
            AND COALESCE(celular, '') = COALESCE(row_phone, '')))
    LIMIT 1;

    IF person_id IS NULL THEN
      INSERT INTO public.comedor_people (center_id, nombre, apellido, celular, numero_documento)
      VALUES (p_center_id, row_name, row_last_name, row_phone, row_document)
      RETURNING id INTO person_id;
      created_count := created_count + 1;
    END IF;

    INSERT INTO public.comedor_visits (center_id, person_id, visit_date, created_by)
    VALUES (p_center_id, person_id, row_date, auth.uid())
    ON CONFLICT (person_id, visit_date) DO NOTHING;
    IF FOUND THEN visit_count := visit_count + 1; ELSE skipped_count := skipped_count + 1; END IF;
    person_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('ok', visit_count, 'created', created_count, 'skipped', skipped_count);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.import_comedor_rows(JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_comedor_rows(JSONB, UUID) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.comedor_people TO authenticated;
GRANT SELECT, INSERT ON public.comedor_visits TO authenticated;
