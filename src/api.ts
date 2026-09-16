import { createClient } from '@supabase/supabase-js'
import { Booking, CustomerInfo } from './types'
import { calculateQuote, QuoteResult } from './pricing'

// Supabase backend (project mesqxoujuxothdqjwhwd).
// Tables: users_list (telegram_id, role, phone, address, unit, credits)
//         bookings  (id, customer_id, start_time, end_time, pax, location, transport_option, quote_price, status)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --- Supabase row shapes ---
interface UserRow { telegram_id: number; role: string; phone: string; address: string; unit: string; credits: number }
interface BookingRow {
  id: string
  customer_id: number
  start_time: string
  end_time: string
  pax: number
  location: string
  transport_option: string
  quote_price: number
  status: string
}

function rowToCustomer(r: UserRow): CustomerInfo {
  return { telegramUserId: r.telegram_id, name: r.role || `Customer ${r.telegram_id}`, phone: r.phone, address: r.address, unit: r.unit, credits: r.credits }
}
function customerToUpsert(c: CustomerInfo) {
  return { telegram_id: c.telegramUserId, role: c.name, phone: c.phone, address: c.address, unit: c.unit, credits: c.credits }
}
function rowToBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    telegramUserId: r.customer_id,
    name: '',
    phone: '', address: '', unit: '',
    people: r.pax,
    startISO: r.start_time,
    location: r.location,
    quote: { base: r.quote_price, option: 'NONE', taxiFare: 0, total: r.quote_price, currency: 'HKD' },
    status: (r.status as Booking['status']) || 'pending',
  }
}

export const API = {
  // Telegram Login: parse the WebApp initData user directly (no worker in the path).
  async getLogin() {
    const tg = (window as any).Telegram?.WebApp
    const u = tg?.initDataUnsafe?.user
    if (u && u.id) return { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'user', username: u.username }
    // Dev fallback so the app still opens in a plain browser.
    return { id: 7735683983, name: 'HK', username: 'hkmemberonly' }
  },

  async listBookings(): Promise<Booking[]> {
    const { data, error } = await supabase.from('bookings').select('*').order('start_time')
    if (error) throw new Error(error.message)
    return (data as BookingRow[]).map(rowToBooking)
  },

  async listCustomers(): Promise<CustomerInfo[]> {
    const { data, error } = await supabase.from('users_list').select('*').order('telegram_id')
    if (error) throw new Error(error.message)
    return (data as UserRow[]).map(rowToCustomer)
  },

  async updateCustomer(c: CustomerInfo): Promise<CustomerInfo> {
    const { error } = await supabase.from('users_list').upsert(customerToUpsert(c), { onConflict: 'telegram_id' })
    if (error) throw new Error(error.message)
    return c
  },

  async setBookingStatus(id: string, status: 'accepted' | 'rejected'): Promise<Booking> {
    const { data, error } = await supabase.from('bookings').update({ status }).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return rowToBooking(data as BookingRow)
  },

  // Quote is computed locally with the shared pricing engine.
  async previewQuote(args: {
    startISO: string
    people: number
    location: string
    onHKIslandMTR: boolean
    inKowloonOrNT: boolean
    requestTaxi: boolean
  }): Promise<QuoteResult> {
    return calculateQuote({ ...args, uberHighFare: args.requestTaxi ? 300 : undefined })
  },

  async createBooking(b: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
    // Ensure the customer row exists (bookings.customer_id references users_list.telegram_id).
    await supabase.from('users_list').upsert(
      { telegram_id: b.telegramUserId, role: b.name || `Customer ${b.telegramUserId}`, phone: b.phone, address: b.address, unit: b.unit, credits: 0 },
      { onConflict: 'telegram_id' },
    )
    const start = new Date(b.startISO)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const option = b.quote?.option === 'NONE' ? 'taxi' : String(b.quote?.option ?? 'taxi').toLowerCase() === 'taxi' ? 'taxi' : 'taxi'
    const { data, error } = await supabase.from('bookings').insert({
      customer_id: b.telegramUserId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      pax: b.people,
      location: b.location,
      transport_option: option,
      quote_price: b.quote?.total ?? 0,
      status: 'pending',
    }).select('*').single()
    if (error) throw new Error(error.message)
    return rowToBooking(data as BookingRow)
  },
}

export { calculateQuote }
