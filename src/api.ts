import { supabase } from './supabase'
import { Booking, CustomerInfo, ItemOrder } from './types'
import { calculateQuote, QuoteResult } from './pricing'
import { DbBooking, DbUser } from './supabase'

// Same admin list as App.tsx (usernames are stored lowercase).
const ADMIN_USERNAMES = ['mileschan852', 'hkmembersonly']

// ---- mappers: DB rows <-> app types ----

function bookingToApp(row: DbBooking): Booking {
  return {
    id: row.id,
    telegramUserId: row.customer_id,
    name: String(row.customer_id),
    phone: '',
    address: '',
    unit: '',
    people: row.pax,
    startISO: row.start_time,
    location: row.location,
    quote: {
      base: (row as any).quote_base ?? row.quote_price,
      option: row.transport_option ?? '',
      taxiFare: 0,
      total: row.quote_price,
      currency: 'HKD',
    },
    status: row.status,
    receiptStatus: (row as any).receipt_status ?? null,
    receiptImageUrl: (row as any).receipt_image_url ?? null,
    quote_base: (row as any).quote_base ?? null,
    creditsUsed: (row as any).credits_used ?? 0,
  }
}

function userToCustomer(row: DbUser): CustomerInfo {
  const streetNumber = row.street_number ?? ''
  const streetName = row.street_name ?? (row.address && !streetNumber ? row.address : '')
  return {
    username: row.username ?? '',
    telegramUserId: row.telegram_id,
    name: row.name || (row.role === 'admin' ? 'Admin' : (row.username ? `@${row.username}` : `Customer ${row.telegram_id}`)),
    phone: row.phone ?? '',
    streetNumber,
    streetName,
    address: [streetNumber, streetName].filter(Boolean).join(' '),
    unit: row.unit ?? '',
    passcode: row.passcode ?? '',
    credits: row.credits ?? 0,
    surcharge: row.surcharge ?? 0,
    surchargeMode: (row.surcharge_mode as CustomerInfo['surchargeMode']) ?? 'addition',
    closestMtr: row.closest_mtr ?? '',
    showItems: (row as any).show_items ?? false,
  }
}

export const API = {
  async getLogin(): Promise<{ id: number; name: string; username?: string }> {
    // Telegram WebApp user identity (client-side; the DB is the source of truth for access).
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
    if (!u) throw new Error('not in Telegram')
    const id = u.id
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'user'

    // Upsert into users_list keyed by @username. The username column is the
    // canonical identity; telegram_id is kept for legacy rows/back-reference.
    const username = (u.username ?? '').toLowerCase()
    if (!username) throw new Error('This Telegram account has no @username. Please set one in Telegram settings, then retry.')
    const isAdminName = ADMIN_USERNAMES.includes(username)

    // Robust identity save: select-then-update-or-insert so it works whether or
    // not the unique index on username exists (avoids users_list_pkey conflicts).
    const { data: existing } = await supabase
      .from('users_list')
      .select('username')
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      const { error } = await supabase
        .from('users_list')
        .update({ username, ...(isAdminName ? { role: 'admin' } : {}) })
        .eq('username', username)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('users_list')
        .insert({ username, telegram_id: id, phone: null, address: null, unit: null, credits: 0, ...(isAdminName ? { role: 'admin' } : {}) })
      if (error) throw new Error(error.message)
    }
    return { id, name, username }
  },

  async listBookings(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('start_time', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as DbBooking[]).map(bookingToApp)
  },

  async listCustomers(): Promise<CustomerInfo[]> {
    const { data, error } = await supabase
      .from('users_list')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as DbUser[]).map(userToCustomer)
  },

  async updateCustomer(c: CustomerInfo): Promise<CustomerInfo> {
    const { error } = await supabase
      .from('users_list')
      .update({ name: c.name || null, phone: c.phone, street_number: c.streetNumber, street_name: c.streetName, address: c.address, unit: c.unit, passcode: c.passcode, credits: c.credits, surcharge: c.surcharge, surcharge_mode: c.surchargeMode, closest_mtr: (c.closestMtr || null), show_items: c.showItems })
      .eq('username', c.username)
    if (error) throw new Error(error.message)
    return c
  },

  async removeCustomer(username: string): Promise<void> {
    const { error } = await supabase
      .from('users_list')
      .delete()
      .eq('username', username)
    if (error) throw new Error(error.message)
  },

  async addCustomer(username: string): Promise<CustomerInfo> {
    // Insert a fresh row. select-then-insert so it also works when the row
    // exists but only has telegram_id set (pre-username legacy rows).
    const { data: existing, error: selErr } = await supabase
      .from('users_list')
      .select('*')
      .eq('username', username)
      .maybeSingle()
    if (selErr) throw new Error(selErr.message)
    if (existing) return userToCustomer(existing as DbUser)
    const { data, error } = await supabase
      .from('users_list')
      .insert({ username, name: null, phone: null, street_number: null, street_name: null, address: null, unit: null, passcode: null, credits: 0, surcharge: 0, surcharge_mode: 'addition', closest_mtr: null })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return userToCustomer(data as DbUser)
  },

  async setBookingStatus(id: string, status: 'accepted' | 'rejected'): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return bookingToApp(data as DbBooking)
  },

  // Admin accepted the quote on the block. For taxi quotes the admin first
  // enters the adjusted transport fare; the total is updated accordingly.
  async acceptQuote(id: string, adjustedFare?: number): Promise<void> {
    if (typeof adjustedFare === 'number') {
      const { data } = await supabase.from('bookings').select('quote_base, customer_id').eq('id', id).maybeSingle()
      const base = Number((data as any)?.quote_base ?? 0)
      // The adjusted transport amount admin enters is NOT payable with credits.
      // Recompute credit coverage against the base (service) portion only.
      const custId = Number((data as any)?.customer_id ?? 0)
      let creditsUsed = 0
      if (custId) {
        const { data: u } = await supabase.from('users_list').select('credits').eq('telegram_id', custId).maybeSingle()
        if (u) creditsUsed = Math.min(Math.max(0, Number((u as any).credits ?? 0)), Math.max(0, base))
      }
      const { error } = await supabase
        .from('bookings')
        .update({ quote_price: base + adjustedFare, transport_option: 'B', receipt_status: 'requested', status: 'accepted', credits_used: creditsUsed })
        .eq('id', id)
      if (error) throw new Error(error.message)
      return
    }
    const { error } = await supabase
      .from('bookings')
      .update({ receipt_status: 'requested', status: 'accepted' })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  // Client uploaded their receipt from the block: waiting for admin review.
  async submitReceipt(id: string, imageUrl: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ receipt_image_url: imageUrl, receipt_status: 'submitted' })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  // Admin accepted the receipt: green for admin, red for everyone else.
  async confirmReceipt(id: string): Promise<void> {
    // Payment is now confirmed: deduct the credits this booking consumed.
    const { data: b } = await supabase.from('bookings').select('customer_id, credits_used, receipt_status').eq('id', id).maybeSingle()
    const used = Number((b as any)?.credits_used ?? 0)
    const custId = Number((b as any)?.customer_id ?? 0)
    if (used > 0 && custId && (b as any)?.receipt_status !== 'confirmed') {
      const { data: u } = await supabase.from('users_list').select('credits').eq('telegram_id', custId).maybeSingle()
      if (u) await supabase.from('users_list').update({ credits: Math.max(0, Number((u as any).credits ?? 0) - used) }).eq('telegram_id', custId)
    }
    const { error } = await supabase
      .from('bookings')
      .update({ receipt_status: 'confirmed', status: 'accepted' })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  // Admin rejected the receipt: booking reverts to the yellow quoted state and
  // the client must upload a new receipt.
  async rejectReceipt(id: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ receipt_status: 'requested', receipt_image_url: null })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async previewQuote(args: {
    startISO: string
    people: number
    location: string
    closestMtr?: string
    onHKIslandMTR: boolean
    inKowloonOrNT: boolean
    requestTaxi: boolean
    surcharge?: number
    surchargeMode?: 'per_person' | 'addition' | 'fixed'
  }): Promise<QuoteResult> {
    // Quote logic lives in src/pricing.ts, shared client + (former) worker.
    return calculateQuote(args)
  },

  async createBooking(b: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
    const start = new Date(b.startISO)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    // Credits are NOT deducted here. The booking only records how much of
    // the total can be covered by the client's current credits (credits_used).
    // Actual deduction happens when admin confirms the receipt (payment).
    const username = (b as any).username ?? ''
    let creditsUsed = 0
    if (username) {
      const { data: u } = await supabase.from('users_list').select('credits').eq('username', username).maybeSingle()
      creditsUsed = Math.min(Math.max(0, Number((u as any)?.credits ?? 0)), Math.max(0, b.quote.total))
    }
    const row = {
      customer_id: b.telegramUserId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      pax: b.people,
      location: b.location,
      transport_option: b.quote.option || null,
      quote_base: b.quote.base,
      quote_price: b.quote.total,
      status: 'pending' as const,
      credits_used: creditsUsed,
    }
    const { data, error } = await supabase.from('bookings').insert(row).select().single()
    if (error) throw new Error(error.message)
    notifyAdminBot(`New booking: ${b.name}, ${start.toLocaleString('en-HK')}, ${b.people}p, ${b.quote.total} HKD${creditsUsed > 0 ? ` (credits used: ${creditsUsed}, to pay: ${b.quote.total - creditsUsed})` : ''}`).catch(() => {})
    return bookingToApp(data as DbBooking)
  },

  // Items page: store the order + receipt image in Supabase. The receipt file
  // goes to the `receipts` storage bucket under item-orders/, and the order
  // row lands in `item_orders` (see schema/ item_orders migration).
  async uploadItemReceipt(username: string, items: string[], total: number, file: File): Promise<string> {
    const path = `item-orders/${username}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
    if (upErr) throw new Error(upErr.message)
    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    const publicUrl = data?.publicUrl ?? ''
    const { error } = await supabase.from('item_orders').insert({
      username,
      items,
      total,
      receipt_url: publicUrl,
      status: 'pending',
    })
    if (error) throw new Error(error.message)
    notifyAdminBot(`New item order: ${username}, ${items.join(', ')}, ${total} HKD`).catch(() => {})
    return publicUrl
  },

  // Admin orders list (Items page orders). New orders first.
  async listItemOrders(): Promise<ItemOrder[]> {
    const { data, error } = await supabase
      .from('item_orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as any[]).map((r) => ({
      id: r.id,
      username: r.username,
      items: Array.isArray(r.items) ? r.items : [],
      total: r.total ?? 0,
      receiptUrl: r.receipt_url ?? null,
      status: r.status ?? 'pending',
      createdAt: r.created_at,
    }))
  },

  // Completing an order deletes it, per spec.
  async completeItemOrder(id: string): Promise<void> {
    const { error } = await supabase.from('item_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  // Add the purchase amount of a completed prepay order to the user's credits.
  async addCredits(username: string, amount: number): Promise<void> {
    const { data, error } = await supabase
      .from('users_list')
      .select('credits')
      .eq('username', username)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const current = Number((data as any)?.credits ?? 0)
    const { error: upErr } = await supabase
      .from('users_list')
      .update({ credits: current + amount })
      .eq('username', username)
    if (upErr) throw new Error(upErr.message)
  },

  async saveAdminLocation(lat: number, lng: number): Promise<void> {
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
    const username = (u?.username ?? '').toLowerCase()
    if (!username) throw new Error('no username')
    const { error } = await supabase
      .from('users_list')
      .update({ last_lat: lat, last_lng: lng, last_loc_at: new Date().toISOString() })
      .eq('username', username)
    if (error) throw new Error(error.message)
  },

  // Customer map view: the admin's (Miles') last saved location.
  async getAdminLocation(): Promise<{ lat: number; lng: number; at: string } | null> {
    const { data, error } = await supabase
      .from('users_list')
      .select('last_lat, last_lng, last_loc_at')
      .in('role', ['admin'])
      .order('last_loc_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data || data.last_lat == null || data.last_lng == null) return null
    return { lat: data.last_lat, lng: data.last_lng, at: data.last_loc_at ?? '' }
  },

  // Admin booking: occupy the slot immediately ("not available" on the
  // calendar). Stored as a blocked booking with status 'blocked'.
  async createBlockBooking(args: { startISO: string }): Promise<Booking> {
    const start = new Date(args.startISO)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const row = {
      customer_id: 0,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      pax: 0,
      location: 'blocked by admin',
      transport_option: null,
      quote_price: 0,
      status: 'blocked' as const,
    }
    const { data, error } = await supabase.from('bookings').insert(row).select().single()
    if (error) throw new Error(error.message)
    return bookingToApp(data as DbBooking)
  },

  // Availability toggle: is the current hour already blocked?
  async isHourBlocked(hourStart: Date): Promise<boolean> {
    const end = new Date(hourStart.getTime() + 60 * 60 * 1000)
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'blocked')
      .lt('start_time', end.toISOString())
      .gt('end_time', hourStart.toISOString())
      .limit(1)
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },

  async blockCurrentHour(hourStart: Date): Promise<void> {
    await API.createBlockBooking({ startISO: hourStart.toISOString() })
  },

  async unblockCurrentHour(hourStart: Date): Promise<void> {
    const end = new Date(hourStart.getTime() + 60 * 60 * 1000)
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'blocked')
      .lt('start_time', end.toISOString())
      .gt('end_time', hourStart.toISOString())
    if (error) throw new Error(error.message)
    const ids = (data ?? []).map((r: any) => r.id)
    if (ids.length) {
      const { error: delErr } = await supabase.from('bookings').delete().in('id', ids)
      if (delErr) throw new Error(delErr.message)
    }
  },
}

export { calculateQuote }

// Fire-and-forget: notify the admin's Telegram chat via the worker relay.
export async function notifyAdminBot(text: string): Promise<void> {
  try {
    const initData = (window as any).Telegram?.WebApp?.initData || ''
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData, text }),
    })
  } catch {
    // notifications are best-effort; never block the user flow
  }
}
