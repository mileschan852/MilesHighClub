import { useMemo, useState } from 'react'
import { Booking } from '../types'
import { API } from '../api'
import { NON_REFUNDABLE_NOTICE } from '../pricing'

const BOOKING_MS = 60 * 60 * 1000 // booking occupies 1 hour
const MIN_LEAD_MS = 60 * 60 * 1000 // must book at least 1 hour ahead

const DAY_START_HOUR = 0
const SLOT_MINUTES = 30
const PX_PER_MIN = 1.4 // hour row = 84px

interface DayBooking {
  start: Date
  end: Date
  booking: Booking
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtHk(d: Date) {
  return d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDay(d: Date) {
  return d.toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Google Calendar "add event" link for a booking.
function gcalUrl(b: { startISO: string; location: string; people: number }) {
  const s = new Date(b.startISO)
  const e = new Date(s.getTime() + BOOKING_MS)
  const f = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Booking with Miles (${b.people}p)`,
    dates: `${f(s)}/${f(e)}`,
    location: b.location,
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export default function CalendarPage({ bookings, user, onBooked }: { bookings: Booking[]; user: { id: number; name: string }; onBooked: () => void }) {
  // Day-view state: the day being viewed (default: today).
  const [viewDate, setViewDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
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

  const shiftDay = (delta: number) => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + delta)
    d.setHours(0, 0, 0, 0)
    setViewDate(d)
    setPicked(null)
    setQuote(null)
  }

  // Bookings overlapping the viewed day.
  const dayBookings = useMemo(() => {
    const dayEnd = new Date(viewDate); dayEnd.setHours(23, 59, 59, 999)
    return bookings
      .filter((b) => b.status !== 'rejected')
      .map((b) => ({ start: new Date(b.startISO), end: new Date(new Date(b.startISO).getTime() + BOOKING_MS), booking: b }))
      .filter((x) => x.end > viewDate && x.start < dayEnd)
  }, [bookings, viewDate])

  const now = new Date()
  const isToday = sameDay(viewDate, now)

  // Earliest bookable moment: next half hour at least MIN_LEAD_MS away.
  const earliest = useMemo(() => {
    const t = new Date(now.getTime() + MIN_LEAD_MS)
    t.setSeconds(0, 0)
    t.setMinutes(Math.ceil(t.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES)
    return t
  }, [now])

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const grid = e.currentTarget
    const rect = grid.getBoundingClientRect()
    const y = e.clientY - rect.top + grid.scrollTop
    const minutesFromMidnight = Math.round(y / PX_PER_MIN / SLOT_MINUTES) * SLOT_MINUTES
    const start = new Date(viewDate)
    start.setHours(0, minutesFromMidnight, 0, 0)
    const end = new Date(start.getTime() + BOOKING_MS)
    const clash = dayBookings.some((x) => x.start < end && x.end > start)
    if (start < earliest) { setErr(`Too soon: pick a slot at least 1 hour ahead (from ${fmtHk(earliest)})`); setPicked(null); setQuote(null); return }
    if (clash) { setErr('That slot overlaps an existing booking'); setPicked(null); setQuote(null); return }
    setErr('')
    setPicked(start)
    setQuote(null)
  }

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

  const hours = Array.from({ length: 24 }, (_, h) => h)
  const nowTop = isToday ? ((now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN) : null

  return (
    <div className="calendar dayview">
      <div className="dayview-header">
        <button onClick={() => shiftDay(-1)}>‹ Prev</button>
        <button className="ghost" onClick={() => shiftDay(0)}>Today</button>
        <h2>{fmtDay(viewDate)}{isToday ? ' · Today' : ''}</h2>
        <button onClick={() => shiftDay(1)}>Next ›</button>
      </div>

      <div className="dayview-grid-wrap">
        <div className="dayview-hours">
          {hours.map((h) => (
            <div key={h} className="dayview-hour-label" style={{ height: 60 * PX_PER_MIN }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <div className="dayview-grid" style={{ height: 24 * 60 * PX_PER_MIN }} onClick={handleGridClick}>
          {hours.map((h) => (
            <div key={h} className="dayview-hourline" style={{ top: h * 60 * PX_PER_MIN }} />
          ))}
          {nowTop !== null && <div className="dayview-now" style={{ top: nowTop }} />}
          {dayBookings.map(({ start, end, booking }) => {
            const top = (start.getHours() * 60 + start.getMinutes()) * PX_PER_MIN
            const height = Math.max(((end.getTime() - start.getTime()) / 60000) * PX_PER_MIN, 24)
            return (
              <div
                key={booking.id}
                className={`dayview-event status-${booking.status}`}
                style={{ top, height }}
              >
                <strong>{fmtHk(start)}–{fmtHk(end)}</strong>
                <span>{booking.status === 'pending' ? '⏳ Pending' : booking.status === 'accepted' ? '✅ Accepted' : booking.status} · {booking.people}p</span>
                {booking.telegramUserId === user.id && (
                  <a
                    href={gcalUrl(booking)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="gcal-link"
                  >📅 Add to Google Calendar</a>
                )}
              </div>
            )
          })}
          {picked && sameDay(picked, viewDate) && (
            <div
              className="dayview-picked"
              style={{ top: (picked.getHours() * 60 + picked.getMinutes()) * PX_PER_MIN, height: BOOKING_MS / 60000 * PX_PER_MIN }}
            >
              Selected {fmtHk(picked)}–{fmtHk(new Date(picked.getTime() + BOOKING_MS))}
            </div>
          )}
        </div>
      </div>
      <p className="dayview-hint">Tap an empty hour to book (1 hour block, min 1h ahead).</p>

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
