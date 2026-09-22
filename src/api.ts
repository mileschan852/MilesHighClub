import { Booking, CustomerInfo, ItemOrder } from './types'
import { calculateQuote, QuoteResult } from './pricing'

// All-Cloudflare API: every call goes to our own Worker (/api/*), which talks
// to D1 (database) and R2 (receipt files). No Supabase anywhere.

async function api(path: string, init?: RequestInit): Promise<any> {
  const initData = (window as any).Telegram?.WebApp?.initData || ''
  const res = await fetch(path, {
    ...init,
    headers: { 'x-init-data': initData, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json() as any; msg = j?.error ?? msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

function toCustomer(c: any): CustomerInfo {
  return { ...c, telegramUserId: Number(c.telegramUserId ?? 0) }
}

export const API = {
  async getLogin(): Promise<{ id: number; name: string; username?: string }> {
    return api('/api/login', { method: 'POST' })
  },

  async listBookings(): Promise<Booking[]> {
    return api('/api/bookings')
  },

  async listCustomers(): Promise<CustomerInfo[]> {
    const rows = await api('/api/customers')
    return (rows as any[]).map(toCustomer)
  },

  async updateCustomer(c: CustomerInfo): Promise<CustomerInfo> {
    return api('/api/customers', { method: 'POST', body: JSON.stringify(c), headers: { 'content-type': 'application/json' } })
  },

  async removeCustomer(username: string): Promise<void> {
    await api(`/api/customers/${encodeURIComponent(username)}`, { method: 'DELETE' })
  },

  async addCustomer(username: string): Promise<CustomerInfo> {
    await api('/api/customers', { method: 'POST', body: JSON.stringify({ username, telegramUserId: 0, name: '', phone: '', streetNumber: '', streetName: '', address: '', unit: '', passcode: '', credits: 0, surcharge: 0, surchargeMode: 'addition', closestMtr: '', showItems: false }), headers: { 'content-type': 'application/json' } })
    return {
      username, telegramUserId: 0, name: username ? `@${username}` : '', phone: '', streetNumber: '', streetName: '', address: '', unit: '', passcode: '', credits: 0, surcharge: 0, surchargeMode: 'addition', closestMtr: '', showItems: false,
    }
  },

  async setBookingStatus(id: string, status: 'accepted' | 'rejected'): Promise<Booking> {
    return api(`/api/bookings/${id}/status`, { method: 'POST', body: JSON.stringify({ status }), headers: { 'content-type': 'application/json' } })
  },

  // Admin accepted the quote on the block. For taxi quotes the admin first
  // enters the adjusted transport fare; the total is updated accordingly.
  async acceptQuote(id: string, adjustedFare?: number): Promise<void> {
    await api(`/api/bookings/${id}/accept-quote`, { method: 'POST', body: JSON.stringify({ adjustedFare }), headers: { 'content-type': 'application/json' } })
  },

  // Client uploaded their receipt from the block: waiting for admin review.
  async submitReceipt(id: string, imageUrl: string): Promise<void> {
    // imageUrl is a blob/object URL of the file; send the file itself.
    const blob = await (await fetch(imageUrl)).blob()
    const form = new FormData()
    form.append('file', new File([blob], 'receipt.jpg', { type: blob.type || 'image/jpeg' }))
    await api(`/api/bookings/${id}/receipt`, { method: 'POST', body: form })
  },

  // Admin accepted the receipt: green for admin, red for everyone else.
  async confirmReceipt(id: string): Promise<void> {
    await api(`/api/bookings/${id}/receipt`, { method: 'POST', body: JSON.stringify({ action: 'confirm' }), headers: { 'content-type': 'application/json' } })
  },

  // Admin rejected the receipt: booking reverts to the yellow quoted state.
  async rejectReceipt(id: string): Promise<void> {
    await api(`/api/bookings/${id}/receipt`, { method: 'POST', body: JSON.stringify({ action: 'reject' }), headers: { 'content-type': 'application/json' } })
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
    return calculateQuote(args)
  },

  async createBooking(b: Omit<Booking, 'id' | 'status'>): Promise<Booking> {
    return api('/api/bookings', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } })
  },

  // Items page: order + receipt photo go to the worker (R2 + D1).
  async uploadItemReceipt(username: string, items: string[], total: number, file: File): Promise<string> {
    const form = new FormData()
    form.append('username', username)
    form.append('items', JSON.stringify(items))
    form.append('total', String(total))
    form.append('file', file)
    const r = await api('/api/item-orders', { method: 'POST', body: form })
    return r.receiptUrl ?? ''
  },

  async listItemOrders(): Promise<ItemOrder[]> {
    return api('/api/item-orders')
  },

  async completeItemOrder(id: string): Promise<void> {
    await api(`/api/item-orders/${id}`, { method: 'DELETE' })
  },

  async addCredits(username: string, amount: number): Promise<void> {
    // Server-side: completing a prepay-only order auto-adds credits. Manual
    // admin top-up goes through updateCustomer (admin-only credits change).
    const customers = await API.listCustomers()
    const c = customers.find((x) => x.username === username)
    if (c) await API.updateCustomer({ ...c, credits: Number(c.credits ?? 0) + amount })
  },

  async saveAdminLocation(lat: number, lng: number): Promise<void> {
    await api('/api/admin-location', { method: 'POST', body: JSON.stringify({ lat, lng }), headers: { 'content-type': 'application/json' } })
  },

  async getAdminLocation(): Promise<{ lat: number; lng: number; at: string } | null> {
    return api('/api/admin-location')
  },

  async createBlockBooking(args: { startISO: string }): Promise<Booking> {
    await api('/api/block-hour', { method: 'POST', body: JSON.stringify({ startISO: args.startISO }), headers: { 'content-type': 'application/json' } })
    return {} as Booking
  },

  async isHourBlocked(hourStart: Date): Promise<boolean> {
    const bookings = await API.listBookings()
    const end = new Date(hourStart.getTime() + 3600_000)
    return bookings.some((b) => b.status === 'blocked' && new Date(b.startISO) < end && new Date(b.startISO) >= hourStart)
  },

  async blockCurrentHour(hourStart: Date): Promise<void> {
    await API.createBlockBooking({ startISO: hourStart.toISOString() })
  },

  async unblockCurrentHour(hourStart: Date): Promise<void> {
    await api('/api/block-hour', { method: 'POST', body: JSON.stringify({ startISO: hourStart.toISOString(), unblock: true }), headers: { 'content-type': 'application/json' } })
  },
}

export { calculateQuote }

// Fire-and-forget: notify the admin's Telegram chat via the worker relay.
export async function notifyAdminBot(text: string): Promise<void> {
  try {
    const initData = (window as any).Telegram?.WebApp?.initData || ''
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-init-data': initData },
      body: JSON.stringify({ text }),
    })
  } catch {
    // notifications are best-effort; never block the user flow
  }
}
