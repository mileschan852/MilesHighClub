// Cloudflare Worker backend for MilesHighClub — all-in-Cloudflare edition.
// Bindings: D1 (MHC_DB), R2 (RECEIPTS), KV (MHC_KV, legacy), ASSETS (static frontend)
// Secrets: TELEGRAM_BOT_TOKEN. Vars: ADMIN_TELEGRAM_ID, ADMIN_USERNAMES

export interface Env {
  MHC_DB: D1Database
  RECEIPTS: R2Bucket
  MHC_KV?: KVNamespace
  TELEGRAM_BOT_TOKEN: string
  ADMIN_TELEGRAM_ID: string
  ADMIN_USERNAMES?: string
}

import { calculateQuote } from '../src/pricing'
import { Booking, CustomerInfo } from '../src/types'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors() } })
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-init-data' })

// DB rows use snake_case, app types camelCase. Mappers below.

interface DbUser {
  username: string | null
  telegram_id: number | null
  role: string | null
  name: string | null
  phone: string | null
  street_number: string | null
  street_name: string | null
  address: string | null
  unit: string | null
  passcode: string | null
  credits: number | null
  surcharge: number | null
  surcharge_mode: string | null
  closest_mtr: string | null
  show_items: number | null
  last_lat: number | null
  last_lng: number | null
  last_loc_at: string | null
}

interface DbBooking {
  id: string
  customer_id: number | null
  start_time: string
  end_time: string
  pax: number
  location: string | null
  transport_option: string | null
  quote_base: number | null
  quote_price: number
  status: string
  receipt_status: string | null
  receipt_image_url: string | null
  credits_used: number | null
}

function userToCustomer(r: DbUser): CustomerInfo {
  const streetNumber = r.street_number ?? ''
  const streetName = r.street_name ?? (r.address && !streetNumber ? r.address : '')
  return {
    username: r.username ?? '',
    telegramUserId: r.telegram_id ?? 0,
    name: r.name || (r.role === 'admin' ? 'Admin' : (r.username ? `@${r.username}` : `Customer ${r.telegram_id}`)),
    phone: r.phone ?? '',
    streetNumber,
    streetName,
    address: [streetNumber, streetName].filter(Boolean).join(' '),
    unit: r.unit ?? '',
    passcode: r.passcode ?? '',
    credits: Number(r.credits ?? 0),
    surcharge: Number(r.surcharge ?? 0),
    surchargeMode: (r.surcharge_mode as CustomerInfo['surchargeMode']) ?? 'addition',
    closestMtr: r.closest_mtr ?? '',
    showItems: !!r.show_items,
  }
}

function bookingToApp(r: DbBooking): Booking {
  return {
    id: r.id,
    telegramUserId: r.customer_id ?? 0,
    name: '',
    phone: '',
    address: '',
    unit: '',
    people: r.pax,
    startISO: r.start_time,
    location: r.location ?? '',
    quote: {
      base: r.quote_base ?? r.quote_price,
      option: r.transport_option ?? '',
      taxiFare: 0,
      total: r.quote_price,
      currency: 'HKD',
    },
    status: r.status as Booking['status'],
    receiptStatus: (r as any).receipt_status ?? null,
    receiptImageUrl: (r as any).receipt_image_url ?? null,
    quote_base: (r as any).quote_base ?? null,
    creditsUsed: (r as any).credits_used ?? 0,
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
    const url = new URL(req.url)
    const path = url.pathname

    // Receipt file downloads: /receipts/<key> (auth checked against R2 object existence
    // is implicit: unguessable keys). Keep simple public read.
    const rm = path.match(/^\/receipts\/(.+)$/)
    if (rm && req.method === 'GET') {
      const obj = await env.RECEIPTS.get(decodeURIComponent(rm[1]))
      if (!obj) return json({ error: 'not found' }, 404)
      return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } })
    }

    const rawBody = await req.text().catch(() => '')
    const user = await verifyTelegram(req, env, rawBody)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const adminNames = (env.ADMIN_USERNAMES ?? 'mileschan852,hkmembersonly').split(',').map((s) => s.trim().toLowerCase())
    const username = (user.username ?? '').toLowerCase()
    const isAdmin = String(user.id) === env.ADMIN_TELEGRAM_ID || (username && adminNames.includes(username))

    if (path === '/api/login' && req.method === 'POST') {
      if (!username) return json({ error: 'This Telegram account has no @username. Please set one in Telegram settings, then retry.' }, 400)
      await env.MHC_DB.prepare(
        `insert into users_list (username, telegram_id, name, role) values (?1, ?2, ?3, ?4)
         on conflict(username) do update set telegram_id = excluded.telegram_id,
           role = case when ?4 = 'admin' then 'admin' else users_list.role end`
      ).bind(username, user.id, user.name, isAdmin ? 'admin' : 'client').run()
      return json({ id: user.id, name: user.name, username })
    }

    if (path === '/api/quote' && req.method === 'POST') {
      const body = await req.json<any>()
      return json(calculateQuote(body))
    }

    if (path === '/api/bookings' && req.method === 'GET') {
      const { results } = await env.MHC_DB.prepare('select * from bookings order by start_time asc').all<DbBooking>()
      return json((results ?? []).map(bookingToApp))
    }

    if (path === '/api/bookings' && req.method === 'POST') {
      const b = (await req.json<Booking>()) as Booking
      const id = crypto.randomUUID()
      const start = new Date(b.startISO)
      const end = new Date(start.getTime() + 3600_000)
      // credits_used is informational: max credits that can cover this booking.
      let creditsUsed = 0
      const uRow = await env.MHC_DB.prepare('select credits from users_list where username = ?1').bind(username).first<{ credits: number | null }>()
      creditsUsed = Math.min(Math.max(0, Number(uRow?.credits ?? 0)), Math.max(0, b.quote.total))
      await env.MHC_DB.prepare(
        `insert into bookings (id, customer_id, start_time, end_time, pax, location, transport_option, quote_base, quote_price, status, credits_used)
         values (?1,?2,?3,?4,?5,?6,?7,?8,?9,'pending',?10)`
      ).bind(id, user.id, start.toISOString(), end.toISOString(), b.people, b.location, b.quote.option || null, b.quote.base, b.quote.total, creditsUsed).run()
      await notifyAdmin(env, `New booking: ${b.name}, ${start.toLocaleString('en-HK')}, ${b.people}p, ${b.quote.total} HKD${creditsUsed > 0 ? ` (credits used: ${creditsUsed}, to pay: ${b.quote.total - creditsUsed})` : ''}`)
      const row = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(id).first<DbBooking>()
      return json(bookingToApp(row!))
    }

    const mStatus = path.match(/^\/api\/bookings\/([^/]+)\/status$/)
    if (mStatus && req.method === 'POST') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { status } = await req.json<{ status: 'accepted' | 'rejected' }>()
      await env.MHC_DB.prepare('update bookings set status = ?1 where id = ?2').bind(status, mStatus[1]).run()
      const row = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(mStatus[1]).first<DbBooking>()
      if (row) await notifyAdmin(env, `Booking ${row.id} ${status}`)
      return json(row ? bookingToApp(row) : {})
    }

    const mAccept = path.match(/^\/api\/bookings\/([^/]+)\/accept-quote$/)
    if (mAccept && req.method === 'POST') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { adjustedFare } = await req.json<{ adjustedFare?: number }>()
      const row = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(mAccept[1]).first<DbBooking>()
      if (!row) return json({ error: 'not found' }, 404)
      if (typeof adjustedFare === 'number') {
        const base = Number(row.quote_base ?? 0)
        let creditsUsed = 0
        const uRow = await env.MHC_DB.prepare('select credits from users_list where telegram_id = ?1').bind(row.customer_id).first<{ credits: number | null }>()
        creditsUsed = Math.min(Math.max(0, Number(uRow?.credits ?? 0)), Math.max(0, base))
        await env.MHC_DB.prepare(
          `update bookings set quote_price = ?1, transport_option = 'B', receipt_status = 'requested', status = 'accepted', credits_used = ?2 where id = ?3`
        ).bind(base + adjustedFare, creditsUsed, mAccept[1]).run()
      } else {
        await env.MHC_DB.prepare(`update bookings set receipt_status = 'requested', status = 'accepted' where id = ?1`).bind(mAccept[1]).run()
      }
      const upd = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(mAccept[1]).first<DbBooking>()
      return json(bookingToApp(upd!))
    }

    const mReceipt = path.match(/^\/api\/bookings\/([^/]+)\/receipt$/)
    if (mReceipt && req.method === 'POST') {
      // multipart: file + optional action (submit|confirm|reject)
      const ct = req.headers.get('content-type') ?? ''
      if (ct.includes('multipart/form-data')) {
        const form = await req.formData()
        const file = form.get('file') as File | null
        if (!file) return json({ error: 'missing file' }, 400)
        const key = `bookings/${mReceipt[1]}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
        await env.RECEIPTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } })
        const publicUrl = `${url.origin}/receipts/${encodeURIComponent(key)}`
        await env.MHC_DB.prepare(`update bookings set receipt_image_url = ?1, receipt_status = 'submitted' where id = ?2`).bind(publicUrl, mReceipt[1]).run()
        return json({ ok: true, url: publicUrl })
      }
      const { action } = await req.json<{ action?: 'confirm' | 'reject' }>()
      const row = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(mReceipt[1]).first<DbBooking>()
      if (!row) return json({ error: 'not found' }, 404)
      if (action === 'confirm') {
        if (!isAdmin) return json({ error: 'forbidden' }, 403)
        // Payment confirmed: deduct credits this booking consumed.
        const used = Number(row.credits_used ?? 0)
        if (used > 0 && row.customer_id && row.receipt_status !== 'confirmed') {
          await env.MHC_DB.prepare(`update users_list set credits = max(0, credits - ?1) where telegram_id = ?2`).bind(used, row.customer_id).run()
        }
        await env.MHC_DB.prepare(`update bookings set receipt_status = 'confirmed', status = 'accepted' where id = ?1`).bind(mReceipt[1]).run()
      } else if (action === 'reject') {
        if (!isAdmin) return json({ error: 'forbidden' }, 403)
        await env.MHC_DB.prepare(`update bookings set receipt_status = 'requested', receipt_image_url = null where id = ?1`).bind(mReceipt[1]).run()
      } else {
        return json({ error: 'bad action' }, 400)
      }
      const upd = await env.MHC_DB.prepare('select * from bookings where id = ?1').bind(mReceipt[1]).first<DbBooking>()
      return json(bookingToApp(upd!))
    }

    if (path === '/api/customers' && req.method === 'GET') {
      const { results } = await env.MHC_DB.prepare('select * from users_list order by name asc, username asc').all<DbUser>()
      let all = (results ?? []).map(userToCustomer)
      if (!isAdmin) all = all.filter((c) => c.username === username)
      return json(all)
    }

    if (path === '/api/customers' && req.method === 'POST') {
      const c = (await req.json()) as CustomerInfo
      if (!isAdmin && c.username !== username) return json({ error: 'forbidden' }, 403)
      const existing = await env.MHC_DB.prepare('select * from users_list where username = ?1').bind(c.username).first<DbUser>()
      if (!existing) {
        await env.MHC_DB.prepare(
          `insert into users_list (username, credits, surcharge, surcharge_mode) values (?1, 0, 0, 'addition')`
        ).bind(c.username).run()
        return json(c)
      }
      const ex = userToCustomer(existing)
      // Only admin can change credits and name.
      if (!isAdmin) { c.credits = ex.credits; c.name = ex.name }
      await env.MHC_DB.prepare(
        `update users_list set name = ?1, phone = ?2, street_number = ?3, street_name = ?4, address = ?5, unit = ?6,
         passcode = ?7, credits = ?8, surcharge = ?9, surcharge_mode = ?10, closest_mtr = ?11, show_items = ?12
         where username = ?13`
      ).bind(
        c.name || null, c.phone, c.streetNumber, c.streetName, c.address, c.unit, c.passcode,
        c.credits, c.surcharge, c.surchargeMode, c.closestMtr || null, c.showItems ? 1 : 0, c.username
      ).run()
      return json(c)
    }

    const mDel = path.match(/^\/api\/customers\/([^/]+)$/)
    if (mDel && req.method === 'DELETE') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      await env.MHC_DB.prepare('delete from users_list where username = ?1').bind(decodeURIComponent(mDel[1])).run()
      return json({ ok: true })
    }

    if (path === '/api/item-orders' && req.method === 'GET') {
      const { results } = await env.MHC_DB.prepare('select * from item_orders order by created_at desc').all<any>()
      return json((results ?? []).map((r) => ({
        id: r.id, username: r.username,
        items: safeParse(r.items), total: r.total ?? 0,
        receiptUrl: r.receipt_url ?? null, status: r.status ?? 'pending', createdAt: r.created_at,
      })))
    }

    if (path === '/api/item-orders' && req.method === 'POST') {
      const form = await req.formData()
      const usernameField = String(form.get('username') ?? username)
      const items = safeParse(String(form.get('items') ?? '[]'))
      const total = Number(form.get('total') ?? 0)
      const file = form.get('file') as File | null
      let publicUrl: string | null = null
      if (file) {
        const key = `item-orders/${usernameField}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
        await env.RECEIPTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } })
        publicUrl = `${url.origin}/receipts/${encodeURIComponent(key)}`
      }
      const id = crypto.randomUUID()
      await env.MHC_DB.prepare(
        `insert into item_orders (id, username, items, total, receipt_url, status) values (?1,?2,?3,?4,?5,'pending')`
      ).bind(id, usernameField, JSON.stringify(items), total, publicUrl).run()
      await notifyAdmin(env, `New item order: ${usernameField}, ${(items as string[]).join(', ')}, ${total} HKD`)
      return json({ id, username: usernameField, items, total, receiptUrl: publicUrl, status: 'pending' })
    }

    const mOrder = path.match(/^\/api\/item-orders\/([^/]+)$/)
    if (mOrder && req.method === 'DELETE') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const row = await env.MHC_DB.prepare('select * from item_orders where id = ?1').bind(mOrder[1]).first<any>()
      if (row) {
        await env.MHC_DB.prepare('delete from item_orders where id = ?1').bind(mOrder[1]).run()
        // Prepay-only orders add the purchase amount to the user's credits.
        const items = safeParse(row.items) as any[]
        const isPrepayOnly = Array.isArray(items) && items.length > 0 && items.every((i: any) => /prepay/i.test(String(i?.name ?? i)))
        if (isPrepayOnly) {
          const amount = Number(row.total ?? 0)
          if (amount > 0) await env.MHC_DB.prepare('update users_list set credits = credits + ?1 where username = ?2').bind(amount, row.username).run()
        }
      }
      return json({ ok: true })
    }

    if (path === '/api/admin-location' && req.method === 'POST') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { lat, lng } = await req.json<{ lat: number; lng: number }>()
      await env.MHC_DB.prepare(
        `update users_list set last_lat = ?1, last_lng = ?2, last_loc_at = ?3 where username = ?4`
      ).bind(lat, lng, new Date().toISOString(), username).run()
      return json({ ok: true })
    }

    if (path === '/api/admin-location' && req.method === 'GET') {
      const row = await env.MHC_DB.prepare(
        `select last_lat, last_lng, last_loc_at from users_list where role = 'admin' and last_lat is not null
         order by last_loc_at desc limit 1`
      ).first<{ last_lat: number; last_lng: number; last_loc_at: string }>()
      if (!row) return json(null)
      return json({ lat: row.last_lat, lng: row.last_lng, at: row.last_loc_at ?? '' })
    }

    // Admin blocks/unblocks an hour on the calendar.
    if (path === '/api/block-hour' && req.method === 'POST') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { startISO, unblock } = await req.json<{ startISO: string; unblock?: boolean }>()
      const start = new Date(startISO)
      const end = new Date(start.getTime() + 3600_000)
      if (unblock) {
        await env.MHC_DB.prepare(
          `delete from bookings where status = 'blocked' and start_time < ?1 and end_time > ?2`
        ).bind(end.toISOString(), start.toISOString()).run()
        return json({ ok: true })
      }
      const id = crypto.randomUUID()
      await env.MHC_DB.prepare(
        `insert into bookings (id, customer_id, start_time, end_time, pax, location, quote_price, status)
         values (?1, 0, ?2, ?3, 0, 'blocked by admin', 0, 'blocked')`
      ).bind(id, start.toISOString(), end.toISOString()).run()
      return json({ ok: true, id })
    }

    if (path === '/api/notify' && req.method === 'POST') {
      const { text } = JSON.parse(rawBody || '{}') as { text?: string }
      if (text) await notifyAdmin(env, String(text).slice(0, 1000))
      return json({ ok: true })
    }

    return json({ error: 'not found' }, 404)
  },
}

function safeParse(s: string | null): any {
  try { return JSON.parse(s ?? '[]') } catch { return [] }
}

async function verifyTelegram(req: Request, env: Env, rawBody?: string) {
  // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
  const headerData = req.headers.get('x-init-data') || ''
  let initData = rawBody ?? headerData
  try {
    const parsed = JSON.parse(rawBody ?? '') as any
    if (parsed && typeof parsed.initData === 'string') initData = parsed.initData
  } catch {}
  if (!initData || !env.TELEGRAM_BOT_TOKEN) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')!
  if (!hash) return null
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

async function notifyAdmin(env: Env, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_TELEGRAM_ID) return
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.ADMIN_TELEGRAM_ID, text }),
  }).catch(() => {})
}
