-- Run this once in Supabase SQL Editor after schema.sql.
-- It stores each user's calendar entries privately and keeps one entry per day.

create table if not exists public.outfit_calendar_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  items jsonb not null default '{}'::jsonb,
  note text,
  temperature numeric,
  weather text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.outfit_calendar_logs enable row level security;
grant select, insert, update, delete on public.outfit_calendar_logs to authenticated;

drop policy if exists "Users manage their own calendar" on public.outfit_calendar_logs;
create policy "Users manage their own calendar"
on public.outfit_calendar_logs for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists outfit_calendar_logs_set_updated_at on public.outfit_calendar_logs;
create trigger outfit_calendar_logs_set_updated_at
before update on public.outfit_calendar_logs
for each row execute function public.set_updated_at();
