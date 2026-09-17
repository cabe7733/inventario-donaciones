-- Migration: Allow volunteer item_type in center_needs
-- Enables centers to request personnel/volunteers for specific tasks and roles

ALTER TABLE center_needs DROP CONSTRAINT IF EXISTS center_needs_item_type_check;
ALTER TABLE center_needs ADD CONSTRAINT center_needs_item_type_check CHECK (item_type IN ('product','medication','medical_supply','volunteer'));
