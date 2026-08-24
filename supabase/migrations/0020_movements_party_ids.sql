-- Donario v3: donor_id and recipient_id on movements.
-- Each medication entry/exit now records who delivered / who received.

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS donor_id UUID REFERENCES donors(id),
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES recipients(id);

CREATE INDEX IF NOT EXISTS idx_movements_donor ON movements (donor_id) WHERE donor_id IS NOT NULL AND deleted = false;
CREATE INDEX IF NOT EXISTS idx_movements_recipient ON movements (recipient_id) WHERE recipient_id IS NOT NULL AND deleted = false;

-- ponytail: RLS for movements was set in 0007 (center-scoped). Donors/recipients
-- are also center-scoped via their tables, so center membership already gates
-- access through FKs. No new policies needed unless we want to lock down by
-- donor/recipient ownership too.
