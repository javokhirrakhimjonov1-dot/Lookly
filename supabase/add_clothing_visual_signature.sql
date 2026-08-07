-- Optional normalized visual attributes used for conservative duplicate checks.
-- Existing wardrobe records remain valid and are compared using their images
-- and legacy metadata until they receive a signature.
alter table public.wardrobe_items
  add column if not exists visual_signature jsonb;
