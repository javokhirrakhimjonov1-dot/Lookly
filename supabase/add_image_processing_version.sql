alter table public.wardrobe_items
  add column if not exists image_processing_version integer not null default 0
  check (image_processing_version >= 0);
