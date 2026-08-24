-- Donario v3: kit deliveries now record the recipient.
-- Kit entrega debe llevar destinatario (obligatorio en UI). Las entregas
-- pasadas quedan con recipient_id NULL y se muestran como "Sin destinatario".

ALTER TABLE kit_deliveries
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES recipients(id);

CREATE INDEX IF NOT EXISTS idx_kit_deliveries_recipient
  ON kit_deliveries (recipient_id) WHERE recipient_id IS NOT NULL AND deleted = false;

-- ponytail: RLS ya cubre kit_deliveries por center_id; recipients también es
-- center-scoped, así que el join no abre nuevas rutas de acceso.
