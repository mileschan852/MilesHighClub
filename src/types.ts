export type Page = 'calendar' | 'map' | 'customers' | 'profile'

export interface Booking {
  id: string
  telegramUserId: number
  name: string
  phone: string
  address: string
  unit: string
  people: number
  startISO: string
  location: string
  quote: { base: number; option: string; taxiFare: number; total: number; currency: string }
  status: 'pending' | 'accepted' | 'rejected'
}

export interface CustomerInfo {
  // Identity is now the Telegram @username (no @). Rows created before the
  // username column existed may only have telegramUserId set.
  username: string
  telegramUserId?: number
  name: string
  phone: string
  address: string
  unit: string
  credits: number
}
