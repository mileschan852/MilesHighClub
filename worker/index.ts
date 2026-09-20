// Cloudflare Worker backend for MilesHighClub.
// KV namespace binding: MHC_KV
// Vars: TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_ID, UBER_API_TOKEN (optional)

export interface Env {
  MHC_KV: KVNamespace
  TELEGRAM_BOT_TOKEN: string
  ADMIN_TELEGRAM_ID: string
  UBER_API_TOKEN?: string
  MILES_LAT?: string
  MILES_LNG?: string
}

import { calculateQuote } from '../src/pricing'
import { Booking, CustomerInfo } from '../src/types'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors() } })
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
    const url = new URL(req.url)
    const path = url.pathname

    // --- auth: verify Telegram initData ---
    const user = await verifyTelegram(req, env)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const isAdmin = String(user.id) === env.ADMIN_TELEGRAM_ID

    if (path === '/api/login' && req.method === 'POST') {
      await upsertCustomer(env, { telegramUserId: user.id, name: user.name })
      return json({ id: user.id, name: user.name, username: (user as any).username })
    }

    if (path === '/api/quote' && req.method === 'POST') {
      const body = await req.json<any>()
      const uber = body.requestTaxi ? await uberHighestFare(env, body.location) : undefined
      const q = calculateQuote({ ...body, uberHighFare: uber })
      return json(q)
    }

    if (path === '/api/bookings' && req.method === 'POST') {
      const b = (await req.json<Booking>()) as Booking
      b.id = crypto.randomUUID()
      b.status = 'pending'
      b.telegramUserId = user.id
      const all = await listBookings(env)
      all.push(b)
      await env.MHC_KV.put('bookings', JSON.stringify(all))
      await notifyAdmin(env, `New booking request: ${b.name}, ${new Date(b.startISO).toLocaleString('en-HK')}, ${b.people}p, ${b.quote.total} HKD`)
      return json(b)
    }

    if (path === '/api/bookings' && req.method === 'GET') return json(await listBookings(env))

    const m = path.match(/^\/api\/bookings\/([^/]+)\/status$/)
    if (m && req.method === 'POST') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { status } = await req.json<{ status: 'accepted' | 'rejected' }>()
      const all = await listBookings(env)
      const b = all.find((x) => x.id === m[1])
      if (b) {
        b.status = status
        await env.MHC_KV.put('bookings', JSON.stringify(all))
        await notifyAdmin(env, `Booking ${b.id} ${status}`)
      }
      return json(b ?? {})
    }

    if (path === '/api/customers' && req.method === 'GET') {
      const all = await listCustomers(env)
      return json(isAdmin ? all : all.filter((c) => c.telegramUserId === user.id))
    }

    if (path === '/api/customers' && req.method === 'POST') {
      const c = await req.json() as CustomerInfo
      if (!isAdmin && c.telegramUserId !== user.id) return json({ error: 'forbidden' }, 403)
      const all = await listCustomers(env)
      const i = all.findIndex((x) => x.telegramUserId === c.telegramUserId)
      if (i >= 0) {
        // only admin can change credits
        if (!isAdmin) c.credits = all[i].credits
        all[i] = { ...all[i], ...c }
      } else all.push(c)
      await env.MHC_KV.put('customers', JSON.stringify(all))
      return json(c)
    }

    return json({ error: 'not found' }, 404)
  },
}

async function verifyTelegram(req: Request, env: Env) {
  // See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
  const body = await req.json<{ initData?: string }>().catch(() => ({ initData: undefined }))
  const initData = body.initData || req.headers.get('x-init-data') || ''
  if (!initData || !env.TELEGRAM_BOT_TOKEN) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')!
  params.delete('hash')
  const dataCheckString = [...params.entries()].sort().map(([k, v]) => `${k}=${v}`).join('\n')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const secret = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN))
  const hmacKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(dataCheckString))
  const computed = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (computed !== hash) return null
  const u = JSON.parse(params.get('user') || '{}')
  return { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'user', username: u.username }
}

async function isNight(startISO: string) {
  const hour = (new Date(startISO).getUTCHours() + 8) % 24
  return hour >= 23 || hour < 8
}

async function uberHighestFare(env: Env, destination: string): Promise<number> {
  // Uber standard TAXI product: maximum standard metered taxi price (one-way),
  // converted to HKD. Fallback: flat 300 HKD one-way metered-taxi band.
  if (!env.UBER_API_TOKEN) return 300
  try {
    const res = await fetch('https://api.uber.com/v1.2/estimates/price', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.UBER_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        start_latitude: Number(env.MILES_LAT ?? 22.28), start_longitude: Number(env.MILES_LNG ?? 114.158),
        end_address: destination, seat_count: 1,
      }),
    })
    const data = await res.json() as { prices?: { display_name?: string; high_estimate?: number }[] }
    const taxiPrices = (data.prices ?? []).filter((p) => (p.display_name ?? '').toLowerCase().includes('taxi'))
    const pool = taxiPrices.length ? taxiPrices : data.prices ?? []
    const usd = Math.max(0, ...pool.map((p) => p.high_estimate ?? 0))
    return usd * 7.8 // USD -> HKD
  } catch {
    return 300
  }
}

async function listBookings(env: Env): Promise<Booking[]> {
  return JSON.parse((await env.MHC_KV.get('bookings')) ?? '[]')
}
async function listCustomers(env: Env): Promise<CustomerInfo[]> {
  return JSON.parse((await env.MHC_KV.get('customers')) ?? '[]')
}
async function upsertCustomer(env: Env, c: Partial<CustomerInfo> & { telegramUserId: number }) {
  const all = await listCustomers(env)
  const i = all.findIndex((x) => x.telegramUserId === c.telegramUserId)
  if (i >= 0) all[i] = { ...all[i], ...c }
  else all.push({ phone: '', streetNumber: '', streetName: '', address: '', unit: '', passcode: '', credits: 0, surcharge: 0, closestMtr: '', name: c.name ?? '', username: c.username ?? '', telegramUserId: c.telegramUserId })
  await env.MHC_KV.put('customers', JSON.stringify(all))
}
async function notifyAdmin(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_TELEGRAM_ID) return
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.ADMIN_TELEGRAM_ID, text }),
  }).catch(() => {})
}
