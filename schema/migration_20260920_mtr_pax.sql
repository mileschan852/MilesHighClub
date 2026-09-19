-- Run in Supabase SQL Editor (project mesqxoujuxothdqjwhwd).
-- Adds the columns the app expects on bookings and the new MTR column on users_list.
alter table public.bookings add column if not exists pax integer not null default 0;
alter table public.bookings add column if not exists quote_price numeric not null default 0;
alter table public.bookings add column if not exists transport_option text;
alter table public.users_list add column if not exists closest_mtr text;
