import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url ?? '', anonKey ?? '')

// Row shapes as they exist in the Supabase database.
export interface DbBooking {
  id: string
  customer_id: number
  start_time: string
  end_time: string
  pax: number
  location: string
  transport_option: string | null
  quote_price: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

export interface DbUser {
  telegram_id: number
  role: string | null
  phone: string | null
  address: string | null
  unit: string | null
  credits: number | null
  created_at: string
}
