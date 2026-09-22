export type Page = 'calendar' | 'map' | 'items' | 'customers' | 'profile'

export interface Booking {
  id: string
  telegramUserId: number
  username?: string
  name: string
  phone: string
  address: string
  unit: string
  people: number
  startISO: string
  location: string
  quote: { base: number; option: string; taxiFare: number; total: number; currency: string }
  status: 'pending' | 'accepted' | 'rejected' | 'blocked'
  // Adjusted transport amount for taxi quotes (set when admin accepts on the block).
  quote_base?: number | null
  // Client receipt submission phase after admin accept:
  //   null / 'requested' - admin accepted, client must upload the receipt (yellow)
  //   'submitted'        - client uploaded, admin must accept/reject the receipt (blue)
  //   'confirmed'        - admin accepted the receipt (green to admin, red to others)
  receiptStatus?: 'requested' | 'submitted' | 'confirmed' | null
  receiptImageUrl?: string | null
  // Credits applied at booking time (deducted from the user's balance).
  creditsUsed?: number | null
}

export interface CustomerInfo {
  // Identity is now the Telegram @username (no @). Rows created before the
  // username column existed may only have telegramUserId set.
  username: string
  telegramUserId?: number
  name: string
  phone: string
  streetNumber: string
  streetName: string
  address: string // combined street number + name (legacy / display)
  unit: string
  passcode: string
  credits: number
  surcharge: number // admin-only extra applied to quotes
  surchargeMode: 'per_person' | 'addition' | 'fixed' // how the surcharge applies
  closestMtr: string // closest MTR station, part of the address
  showItems: boolean // admin toggle: whether this user may open the Items page
}

export interface ItemOrder {
  id: string
  username: string
  items: string[]
  total: number
  receiptUrl?: string | null
  status: string
  createdAt: string
}
