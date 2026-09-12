import { Booking, CustomerInfo } from './types'
import { calculateQuote, QuoteResult } from './pricing'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const API = {
  async getLogin() {
    // Telegram WebApp initData is sent to the worker, which verifies it against the bot token.
    const tg = (window as any).Telegram?.WebApp
    const initData = tg?.initData ?? ''
    const r = await call<{ id: number; name: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })
    return r
  },

  async listBookings(): Promise<Booking[]> {
    return call('/bookings')
  },

  async listCustomers(): Promise<CustomerInfo[]> {
    return call('/customers')
  },

  async updateCustomer(c: CustomerInfo): Promise<CustomerInfo> {
    return call('/customers', { method: 'POST', body: JSON.stringify(c) })
  },

  async setBookingStatus(id: string, status: 'accepted' | 'rejected'): Promise<Booking> {
    return call(`/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
  },

  previewQuote(args: {
    startISO: string
    people: number
    location: string
    onHKIslandMTR: boolean
    inKowloonOrNT: boolean
    requestTaxi: boolean
  }): Promise<QuoteResult> {
    return call('/quote', { method: 'POST', body: JSON.stringify(args) })
  },

  async createBooking(b: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
    return call('/bookings', { method: 'POST', body: JSON.stringify(b) })
  },
}

export { calculateQuote }
