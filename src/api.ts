import { supabase } from './supabase'
import { Booking, CustomerInfo } from './types'
import { calculateQuote, QuoteResult } from './pricing'
import { DbBooking, DbUser } from './supabase'

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
  return {
    telegramUserId: row.telegram_id,
    name: row.role === 'admin' ? 'Admin' : `Customer ${row.telegram_id}`,
    phone: row.phone ?? '',
    address: row.address ?? '',
    unit: row.unit ?? '',
    credits: row.credits ?? 0,
  }
}

export const API = {
  async getLogin(): Promise<{ id: number; name: string; username?: string }> {
    // Telegram WebApp user identity (client-side; the DB is the source of truth for access).
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
    if (!u) throw new Error('not in Telegram')
    const id = u.id
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'user'

    // Upsert into users_list so the admin's customer list sees everyone who logs in.
    const { error } = await supabase.from('users_list').upsert(
      { telegram_id: id, phone: null, address: null, unit: null, credits: 0 },
      { onConflict: 'telegram_id', ignoreDuplicates: true },
    )
    if (error) throw new Error(error.message)
    return { id, name, username: u.username }
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
      .update({ phone: c.phone, address: c.address, unit: c.unit, credits: c.credits })
      .eq('telegram_id', c.telegramUserId)
    if (error) throw new Error(error.message)
    return c
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
}

export { calculateQuote }
