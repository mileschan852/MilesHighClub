-- Booking flow: yellow quote state, receipt flow, admin-adjusted transport.
alter table public.bookings add column if not exists receipt_status text; -- null | 'requested' | 'confirmed'
alter table public.bookings add column if not exists receipt_image_url text;
