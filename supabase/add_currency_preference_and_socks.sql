-- Run once in Supabase SQL Editor for the existing Lookly project.
-- Stores one preferred price currency per user and permits socks in wardrobes.

alter table public.profiles
  add column if not exists preferred_currency text not null default 'USD'
  check (preferred_currency in ('USD', 'UZS', 'RUB'));

alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_category_check;
alter table public.wardrobe_items
  add constraint wardrobe_items_category_check
  check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'socks', 'accessories'));
