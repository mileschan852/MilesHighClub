-- MilesHighClub D1 schema (SQLite / Cloudflare D1)
-- Mirrors the Supabase tables: users_list, bookings, item_orders

create table if not exists users_list (
  username text primary key,
  telegram_id integer,
  role text default 'client',
  name text,
  phone text,
  street_number text,
  street_name text,
  address text,
  unit text,
  passcode text,
  credits numeric default 0,
  surcharge numeric default 0,
  surcharge_mode text default 'addition',
  closest_mtr text,
  show_items integer default 0,
  last_lat real,
  last_lng real,
  last_loc_at text,
  created_at text default (datetime('now'))
);

create table if not exists bookings (
  id text primary key,
  customer_id integer,
  start_time text,
  end_time text,
  pax integer default 1,
  location text,
  transport_option text,
  quote_base numeric,
  quote_price numeric default 0,
  status text default 'pending',
  receipt_status text,
  receipt_image_url text,
  credits_used numeric default 0,
  created_at text default (datetime('now'))
);

create table if not exists item_orders (
  id text primary key,
  username text not null,
  items text not null default '[]',
  total numeric default 0,
  receipt_url text,
  status text default 'pending',
  created_at text default (datetime('now'))
);

create index if not exists bookings_start on bookings(start_time);
create index if not exists bookings_customer on bookings(customer_id);
create index if not exists item_orders_created on item_orders(created_at);
