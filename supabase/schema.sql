-- Lookly pilot data model
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  gender text,
  age integer check (age is null or age between 13 and 120),
  style_aesthetics jsonb not null default '[]'::jsonb,
  heat_adaptation text,
  color_palette text,
  preferred_currency text not null default 'USD' check (preferred_currency in ('USD', 'UZS', 'RUB')),
  body_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  custom_name text,
  category text not null check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'socks', 'accessories')),
  color text not null default '',
  color_hex text not null default '',
  seasons jsonb not null default '[]'::jsonb,
  fabric_weight text not null default 'medium' check (fabric_weight in ('light', 'medium', 'heavy')),
  is_workwear boolean not null default false,
  purchase_price numeric(12, 2) check (purchase_price is null or purchase_price >= 0),
  purchase_currency text not null default 'USD' check (purchase_currency in ('USD', 'UZS', 'RUB')),
  times_worn integer not null default 0 check (times_worn >= 0),
  photo_path text,
  tags jsonb not null default '[]'::jsonb,
  brand_logo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe for existing pilot projects too: old items remain USD until edited.
alter table public.wardrobe_items
  add column if not exists purchase_currency text not null default 'USD'
  check (purchase_currency in ('USD', 'UZS', 'RUB'));

-- An owner can give an item a personal name without replacing the AI's
-- descriptive name, which remains useful for styling and weather matching.
alter table public.wardrobe_items
  add column if not exists custom_name text;

alter table public.profiles
  add column if not exists preferred_currency text not null default 'USD'
  check (preferred_currency in ('USD', 'UZS', 'RUB'));

-- Existing pilot databases retain their original category constraint, so widen
-- it safely before allowing socks to be saved.
alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_category_check;
alter table public.wardrobe_items
  add constraint wardrobe_items_category_check
  check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'socks', 'accessories'));

create index if not exists wardrobe_items_user_id_created_at_idx
  on public.wardrobe_items (user_id, created_at desc);

create table if not exists public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  items jsonb not null default '{}'::jsonb,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_outfits_user_id_created_at_idx
  on public.saved_outfits (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists wardrobe_items_set_updated_at on public.wardrobe_items;
create trigger wardrobe_items_set_updated_at
before update on public.wardrobe_items
for each row execute function public.set_updated_at();

drop trigger if exists saved_outfits_set_updated_at on public.saved_outfits;
create trigger saved_outfits_set_updated_at
before update on public.saved_outfits
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.saved_outfits enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.wardrobe_items to authenticated;
grant select, insert, update, delete on public.saved_outfits to authenticated;

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile"
on public.profiles for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own wardrobe" on public.wardrobe_items;
create policy "Users manage their own wardrobe"
on public.wardrobe_items for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own saved outfits" on public.saved_outfits;
create policy "Users manage their own saved outfits"
on public.saved_outfits for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Private demand signals for upcoming Lookly features. Each user can join a
-- feature once; the owner can review totals in Supabase without exposing one
-- tester's interest to another tester.
create table if not exists public.feature_waitlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key in ('squad_votes', 'premium_try_on', 'shop_missing_pieces', 'deal_notifications', 'privacy_controls')),
  created_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);

alter table public.feature_waitlist enable row level security;
grant select, insert, delete on public.feature_waitlist to authenticated;

drop policy if exists "Users manage their own feature waitlist" on public.feature_waitlist;
create policy "Users manage their own feature waitlist"
on public.feature_waitlist for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Private reports from pilot users. Reports are visible only to the user who
-- submitted them; project owners can review them in the Supabase dashboard.
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 5 and 4000),
  screenshot_path text,
  platform text,
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;
grant select, insert on public.bug_reports to authenticated;

drop policy if exists "Users view their own bug reports" on public.bug_reports;
create policy "Users view their own bug reports"
on public.bug_reports for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users submit their own bug reports" on public.bug_reports;
create policy "Users submit their own bug reports"
on public.bug_reports for insert to authenticated
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('lookly-private', 'lookly-private', false)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880;

-- Pilot account limits are enforced in the database as well as in the app.
-- This prevents a modified client from filling shared storage accidentally.
create or replace function public.enforce_lookly_pilot_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'wardrobe_items' and not exists (
    select 1 from public.wardrobe_items where id = new.id
  ) and (
    select count(*) from public.wardrobe_items where user_id = new.user_id
  ) >= 150 then
    raise exception 'Pilot wardrobe limit reached (150 items).';
  end if;

  if tg_table_name = 'saved_outfits' and not exists (
    select 1 from public.saved_outfits where id = new.id
  ) and (
    select count(*) from public.saved_outfits where user_id = new.user_id
  ) >= 50 then
    raise exception 'Pilot saved-look limit reached (50 looks).';
  end if;
  return new;
end;
$$;

drop trigger if exists wardrobe_items_pilot_limit on public.wardrobe_items;
create trigger wardrobe_items_pilot_limit
before insert on public.wardrobe_items
for each row execute function public.enforce_lookly_pilot_limits();

drop trigger if exists saved_outfits_pilot_limit on public.saved_outfits;
create trigger saved_outfits_pilot_limit
before insert on public.saved_outfits
for each row execute function public.enforce_lookly_pilot_limits();

drop policy if exists "Users manage only their own photos" on storage.objects;
create policy "Users manage only their own photos"
on storage.objects for all to authenticated
using (
  bucket_id = 'lookly-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'lookly-private'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
