# MilesHighClub

Booking app for Miles (Hong Kong). Telegram login + wallet (NFT gate) required to view availability.

## Stack
- React (Vite) + TypeScript
- Cloudflare Worker backend (`worker/`) with KV storage
- Telegram Login Widget auth, TON Connect wallet connect (NFT gate later)
- Uber price estimate stub (pluggable API key)

## Pages (bottom nav)
1. **Calendar** - next 24h availability in 15-min slots; booking = 1 hour from selected slot; must be >= 1h from now
2. **Map** - Miles' last known location; greyed out until 1h before a confirmed booking, re-disables when booking ends
3. **Profile** - phone number, address, unit number, credits
4. **Admin (Miles only)** - calendar of bookings with accept/reject, customer list with editable info & credits

## Pricing rules (HKD)
- Base: 250/person (08:00-23:00), 350/person (23:00-08:00), by booking start hour
- Option A: +50 flat if location is on Hong Kong Island MTR station AND 08:00-23:00
- Option B (taxi request): if 23:00-08:00 AND Kowloon/NT, or customer chose "request taxi":
  Uber estimate Miles' location -> customer location, metered-taxi style: highest fare, round up to nearest 50, x2 round trip

## Quote acceptance
Total shown with notice: **not refundable, not transferable, cannot be used to reschedule if any changes are made after**. Accept / Reject buttons. Booking then awaits Miles' acceptance in the Admin calendar.

## Setup
- `cp .env.example .env` - fill Telegram bot token/name, KV binding
- Deploy worker: `cd worker && npx wrangler deploy`
- Web: `npm install && npm run dev`

## Repo policy
This repository is the single source of truth for the project.
