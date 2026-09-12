import { useMemo, useState } from 'react'
import { Booking } from '../types'
import { API } from '../api'
import { NON_REFUNDABLE_NOTICE } from '../pricing'

const SLOT_MIN = 15
const BOOKING_MS = 60 * 60 * 1000 // booking occupies 1 hour
const MIN_LEAD_MS = 60 * 60 * 1000 // must book at least 1 hour ahead

interface Slot { start: Date; free: boolean }

function buildSlots(bookings: Booking[]): Slot[] {
  const now = Date.now()
  const slots: Slot[] = []
  const first = new Date(now)
  first.setMinutes(Math.ceil(first.getMinutes() / SLOT_MIN) * SLOT_MIN, 0, 0)

  for (let t = first.getTime(); t < now + 24 * 3600 * 1000; t += SLOT_MIN * 60 * 1000) {
    const start = new Date(t)
    const end = new Date(t + BOOKING_MS)
    const free =
      t >= now + MIN_LEAD_MS &&
      !bookings.some(
        (b) =>
          b.status !== 'rejected' &&
          new Date(b.startISO).getTime() < end.getTime() &&
          new Date(b.startISO).getTime() + BOOKING_MS > start.getTime(),
      )
    slots.push({ start, free })
  }
  return slots
}

export default function CalendarPage({ bookings, user, onBooked }: { bookings: Booking[]; user: { id: number; name: string }; onBooked: () => void }) {
  const slots = useMemo(() => buildSlots(bookings), [bookings])
  const [picked, setPicked] = useState<Date | null>(null)
  const [people, setPeople] = useState(1)
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [unit, setUnit] = useState('')
  const [onHKIslandMTR, setHK] = useState(false)
  const [inKowloonOrNT, setKLN] = useState(false)
  const [requestTaxi, setTaxi] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const [err, setErr] = useState('')

  async function getQuote() {
    if (!picked) return setErr('Pick a time slot first')
    try {
      const q = await API.previewQuote({ startISO: picked.toISOString(), people, location, onHKIslandMTR, inKowloonOrNT, requestTaxi })
      setQuote(q)
      setErr('')
    } catch (e: any) {
      setErr(e.message)
    }
  }

  async function acceptQuote() {
    if (!picked || !quote) return
    await API.createBooking({
      telegramUserId: user.id,
      name: user.name,
      phone, address, unit,
      people, location,
      startISO: picked.toISOString(),
      quote,
    })
    setPicked(null); setQuote(null)
    onBooked()
  }

  return (
    <div className="calendar">
      <h2>Next 24 hours</h2>
      <div className="slots">
        {slots.map((s) => (
          <button
            key={s.start.getTime()}
            disabled={!s.free}
            className={s.free ? 'free' : 'busy'}
            onClick={() => { setPicked(s.start); setQuote(null) }}
          >
            {s.start.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' })}
          </button>
        ))}
      </div>

      {picked && !quote && (
        <form onSubmit={(e) => { e.preventDefault(); getQuote() }}>
          <h3>Booking {picked.toLocaleString('en-HK')} (1 hour)</h3>
          <input type="number" min={1} value={people} onChange={(e) => setPeople(+e.target.value)} placeholder="Number of people" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" required />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" required />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit number" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Meeting location" required />
          <label><input type="checkbox" checked={onHKIslandMTR} onChange={(e) => setHK(e.target.checked)} /> On Hong Kong Island MTR station</label>
          <label><input type="checkbox" checked={inKowloonOrNT} onChange={(e) => setKLN(e.target.checked)} /> Kowloon / New Territories</label>
          <label><input type="checkbox" checked={requestTaxi} onChange={(e) => setTaxi(e.target.checked)} /> Request taxi</label>
          <button type="submit">Get Quote</button>
        </form>
      )}

      {quote && (
        <div className="quote">
          <h3>Quote: {quote.total} {quote.currency}</h3>
          <p>Base: {quote.base} · Option {quote.option === 'NONE' ? '—' : quote.option}: {quote.taxiFare}</p>
          <p className="notice">{NON_REFUNDABLE_NOTICE}</p>
          <button onClick={acceptQuote}>Accept</button>
          <button onClick={() => { setQuote(null); setPicked(null) }}>Reject</button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
