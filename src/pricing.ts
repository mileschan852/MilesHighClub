// Shared pricing engine - used by both client (preview) and worker (authoritative).

export interface QuoteInput {
  startISO: string            // booking start (ISO with HK offset)
  people: number
  location: string            // free text address
  closestMtr?: string         // closest MTR station chosen in the form
  onHKIslandMTR: boolean      // location is at/on a Hong Kong Island MTR station
  inKowloonOrNT: boolean      // location is in Kowloon or New Territories
  requestTaxi: boolean        // customer explicitly chose "request taxi"
  surcharge?: number          // admin-set surcharge amount
  surchargeMode?: 'per_person' | 'addition' | 'fixed' // how surcharge applies
}

export interface QuoteResult {
  base: number
  option: 'A' | 'B' | 'NONE'
  taxiFare: number
  surcharge: number      // resolved surcharge amount included in total
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
// Night (23:01-07:59) taxi cost is entered manually by admin.
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

  // Kennedy Town: no transportation charge at all.
  if ((input.closestMtr ?? '') === 'Kennedy Town') {
    taxiFare = 0
    option = 'NONE'
  } else if (night && input.requestTaxi) {
    // Night (23:00-07:59): taxi cost is quoted at 0 here and entered
    // manually by admin via the transport adjustment step.
    taxiFare = 0
    option = 'B'
  } else {
    // Day: flat transport, 50 HK Island / 100 KLN+NT.
    taxiFare = districtTransport(input.onHKIslandMTR, input.inKowloonOrNT)
    option = 'A'
  }

  // Surcharge modes:
  //   per_person: surcharge x head count
  //   addition:   flat add (negative = discount)
  //   fixed:      total replaced by surcharge amount
  const sur = input.surcharge ?? 0
  let surcharge = 0
  switch (input.surchargeMode) {
    case 'per_person': surcharge = sur * input.people; break
    case 'addition': surcharge = sur; break
    case 'fixed': surcharge = sur - (base + taxiFare); break // delta so total == sur
    default: surcharge = sur
  }

  return { base, option, taxiFare, surcharge, total: base + taxiFare + surcharge, currency: 'HKD' }
}

export const NON_REFUNDABLE_NOTICE =
  'This amount is not refundable, not transferable, and cannot be used to reschedule if any changes are made after acceptance.'
