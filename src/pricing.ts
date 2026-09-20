// Shared pricing engine - used by both client (preview) and worker (authoritative).

export interface QuoteInput {
  startISO: string            // booking start (ISO with HK offset)
  people: number
  location: string            // free text address
  onHKIslandMTR: boolean      // location is at/on a Hong Kong Island MTR station
  inKowloonOrNT: boolean      // location is in Kowloon or New Territories
  requestTaxi: boolean        // customer explicitly chose "request taxi"
  uberHighFare?: number       // Uber highest estimate (one-way) from worker, HKD
}

export interface QuoteResult {
  base: number
  option: 'A' | 'B' | 'NONE'
  taxiFare: number
  total: number
  currency: 'HKD'
}

const NIGHT_START = 23 // 23:00
const NIGHT_END = 8    // 08:00

export function isNightRate(hourHK: number): boolean {
  return hourHK >= NIGHT_START || hourHK < NIGHT_END
}

export function roundUpTo10(n: number): number {
  return Math.ceil(n / 10) * 10
}

// Fixed transport rates by district (day only, 08:00-23:00).
// Night (23:01-07:59) always uses taxi = Uber price x 2.
export function districtTransport(hkIsland: boolean, klnOrNT: boolean): number {
  return hkIsland ? 50 : klnOrNT ? 100 : 100 // unknown district defaults to KLN/NT rate
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const start = new Date(input.startISO)
  const hourHK = (start.getUTCHours() + 8) % 24 // Hong Kong = UTC+8

  const night = isNightRate(hourHK)
  const perPerson = night ? 350 : 250
  const base = perPerson * input.people

  let option: QuoteResult['option']
  let taxiFare: number

  if (night && input.requestTaxi) {
    // Night (23:00-07:59): Uber standard taxi, total = 2 x maximum standard
    // metered taxi price, rounded up to the nearest 10 HKD.
    const maxMetered = roundUpTo10(input.uberHighFare ?? 0)
    taxiFare = maxMetered * 2
    option = 'B'
  } else {
    // Day: flat transport, 50 HK Island / 100 KLN+NT.
    taxiFare = districtTransport(input.onHKIslandMTR, input.inKowloonOrNT)
    option = 'A'
  }

  return { base, option, taxiFare, total: base + taxiFare, currency: 'HKD' }
}

export const NON_REFUNDABLE_NOTICE =
  'This amount is not refundable, not transferable, and cannot be used to reschedule if any changes are made after acceptance.'
