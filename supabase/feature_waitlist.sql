-- Run once in Supabase SQL Editor to record demand for all upcoming features.
create table if not exists public.feature_waitlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
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

alter table public.feature_waitlist drop constraint if exists feature_waitlist_feature_key_check;
alter table public.feature_waitlist add constraint feature_waitlist_feature_key_check
check (feature_key in (
  'squad_votes',
  'premium_try_on',
  'shop_missing_pieces',
  'deal_notifications',
  'privacy_controls'
));
