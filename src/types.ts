export type Page = 'calendar' | 'map' | 'profile' | 'admin'

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
  telegramUserId: number
  name: string
  phone: string
  address: string
  unit: string
  credits: number
}
