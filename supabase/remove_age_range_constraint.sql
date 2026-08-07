-- Lookly supports teen and adult styling profiles from 12 through 50.
-- NOT VALID preserves legacy pilot rows while enforcing the rule for writes.
alter table public.profiles drop constraint if exists profiles_age_check;
alter table public.profiles
  add constraint profiles_age_check check (age is null or age between 12 and 50) not valid;
