alter table public.users_list add column if not exists name text;
alter table public.users_list add column if not exists street_number text;
alter table public.users_list add column if not exists street_name text;
alter table public.users_list add column if not exists surcharge numeric default 0;
