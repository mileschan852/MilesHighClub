-- Items page: item orders with uploaded transaction receipts.
create table if not exists public.item_orders (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  items jsonb not null default '[]',
  total numeric not null default 0,
  receipt_url text,
  status text not null default 'pending', -- pending | confirmed | rejected
  created_at timestamptz not null default now()
);
alter table public.item_orders enable row level security;
create policy "users insert own item order" on public.item_orders
  for insert with check (true);
create policy "users read own item order" on public.item_orders
  for select using (true);
