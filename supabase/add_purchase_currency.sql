-- Run once in Supabase SQL Editor before using UZS or RUB prices.
-- Existing prices stay valid and are treated as USD.
alter table public.wardrobe_items
  add column if not exists purchase_currency text not null default 'USD'
  check (purchase_currency in ('USD', 'UZS', 'RUB'));
