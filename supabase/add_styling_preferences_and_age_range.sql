alter table public.profiles
  add column if not exists styling_preferences jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check check (age is null or age between 12 and 50) not valid;
