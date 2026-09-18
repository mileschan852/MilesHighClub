-- Migration 2026-09-18: username identity + admin geolocation
-- Run in Supabase SQL Editor (dashboard) if not yet applied:
alter table public.users_list add column if not exists username text;
create unique index if not exists users_list_username_key on public.users_list (username);

-- Admin last-known location (admin row only, updated by the app):
alter table public.users_list add column if not exists last_lat double precision;
alter table public.users_list add column if not exists last_lng double precision;
alter table public.users_list add column if not exists last_loc_at timestamptz;
