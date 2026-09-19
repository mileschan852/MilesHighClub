import { supabase } from './supabase'
import { Booking, CustomerInfo } from './types'
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
      base: row.quote_price,
      option: row.transport_option ?? '',
      taxiFare: 0,
      total: row.quote_price,
      currency: 'HKD',
    },
    status: row.status,
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
    closestMtr: row.closest_mtr ?? '',
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
      .update({ name: c.name || null, phone: c.phone, street_number: c.streetNumber, street_name: c.streetName, address: c.address, unit: c.unit, passcode: c.passcode, credits: c.credits, surcharge: c.surcharge, closest_mtr: (c.closestMtr || null) })
      .eq('username', c.username)
    if (error) throw new Error(error.message)
    return c
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
      .insert({ username, name: null, phone: null, street_number: null, street_name: null, address: null, unit: null, passcode: null, credits: 0, surcharge: 0, closest_mtr: null })
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

  async previewQuote(args: {
    startISO: string
    people: number
    location: string
    onHKIslandMTR: boolean
    inKowloonOrNT: boolean
    requestTaxi: boolean
  }): Promise<QuoteResult> {
    // Quote logic lives in src/pricing.ts, shared client + (former) worker.
    return calculateQuote({ ...args, uberHighFare: undefined })
  },

  async createBooking(b: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
    const start = new Date(b.startISO)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const row = {
      customer_id: b.telegramUserId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      pax: b.people,
      location: b.location,
      transport_option: b.quote.option || null,
      quote_price: b.quote.total,
      status: 'pending' as const,
    }
    const { data, error } = await supabase.from('bookings').insert(row).select().single()
    if (error) throw new Error(error.message)
    return bookingToApp(data as DbBooking)
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
