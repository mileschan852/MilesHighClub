import { useEffect, useMemo, useRef, useState } from 'react'
import { Booking } from '../types'
import { API } from '../api'
import { supabase } from '../supabase'
import { NON_REFUNDABLE_NOTICE, isNightRate } from '../pricing'
import { CustomerInfo } from '../types'
import { UNIQUE_MTR_STATIONS } from '../mtr'

const BOOKING_MS = 60 * 60 * 1000 // booking occupies 1 hour
const MIN_LEAD_MS = 60 * 60 * 1000 // must book at least 1 hour ahead

const SLOT_MINUTES = 15 // 15-minute time blocks
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

export default function CalendarPage({ bookings, user, isAdmin, customers = [], onBooked }: {
  bookings: Booking[]
  user: { id: number; name: string; username?: string }
  isAdmin: boolean
  customers?: CustomerInfo[]
  onBooked: () => void
}) {
  // Day-view state: the day being viewed (default: today).
  const [viewDate, setViewDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  // Slot the user tapped: shows a "Book this slot" button inside the slot,
  // which pops up the booking form as a modal.
  const [picked, setPicked] = useState<Date | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [people, setPeople] = useState(1)
  const [location, setLocation] = useState('')
  // Booking form: only people + street no/name are asked. Street fields are
  // pre-filled from the customer's saved address (editable). Other fields
  // (phone/unit etc.) ride along from the saved profile silently.
  const [addressNo, setAddressNo] = useState('')
  const [addressName, setAddressName] = useState('')
  const [mtr, setMtr] = useState('')
  const [taxi, setTaxi] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const [err, setErr] = useState('')

  const shiftDay = (delta: number) => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + delta)
    d.setHours(0, 0, 0, 0)
    setViewDate(d)
    setPicked(null)
    setShowForm(false)
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

  // Earliest bookable moment: next 15-min slot at least MIN_LEAD_MS away.
  const earliest = useMemo(() => {
    const t = new Date(now.getTime() + MIN_LEAD_MS)
    t.setSeconds(0, 0)
    t.setMinutes(Math.ceil(t.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES)
    return t
  }, [now])

  function slotIsFree(start: Date) {
    const end = new Date(start.getTime() + BOOKING_MS)
    return !dayBookings.some((x) => x.start < end && x.end > start)
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const grid = e.currentTarget
    const rect = grid.getBoundingClientRect()
    const y = e.clientY - rect.top + grid.scrollTop
    const minutesFromMidnight = Math.round(y / PX_PER_MIN / SLOT_MINUTES) * SLOT_MINUTES
    const start = new Date(viewDate)
    start.setHours(0, minutesFromMidnight, 0, 0)
    if (!slotIsFree(start)) { setErr('That slot is not available'); setPicked(null); setShowForm(false); setQuote(null); return }
    if (start < earliest) { setErr(`Too soon: pick a slot at least 1 hour ahead (from ${fmtHk(earliest)})`); setPicked(null); setShowForm(false); setQuote(null); return }
    setErr('')
    setPicked(start)
    setQuote(null)
  }

  // Admin booking: occupy the slot directly, no details, no quote.
  async function adminOccupy() {
    if (!picked) return
    try {
      await API.createBlockBooking({ startISO: picked.toISOString() })
      setPicked(null); setQuote(null); setShowForm(false)
      onBooked()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  // Pre-fill the booking street fields from the customer's saved profile
  // address each time the form opens (still editable). MTR auto-selects the
  // customer's saved station.
  useEffect(() => {
    if (!showForm) return
    const me = customers.find((c) => c.username === (user.username ?? '').toLowerCase())
    setAddressNo(me?.streetNumber ?? '')
    setAddressName(me?.streetName ?? '')
    setMtr(me?.closestMtr ?? '')
    // Taxi auto-checks for night bookings (11pm-7:59am) unless the MTR
    // station is Kennedy Town or HKU (HK Island west end, day rate applies).
    const night = isNightRate(picked ? (picked.getUTCHours() + 8) % 24 : new Date().getHours())
    const hkIslandMTR = ['Kennedy Town', 'HKU'].includes(me?.closestMtr ?? '')
    setTaxi(night && !hkIslandMTR)
  }, [showForm])

  // Guess district from the street name text so transport pricing applies.
  const HK_ISLAND_STREETS = ['causeway bay', 'wan chai', 'central', 'sheung wan', 'admiralty', 'happy valley', 'north point', 'quarry bay', 'taikoo', 'shau kei wan', 'chai wan', 'aberdeen', 'ap lei chau', 'pok fu lam', 'mid-levels', 'kennedy town', 'sai ying pun', 'soho', 'tai hang', 'braemar', 'stubbs road', 'repulse bay', 'stanley', 'wong chuk hang', 'sham wan', ' Jardine', ' Hennessey', ' Gloucester', ' Hennessy', ' Wellington', ' Queen\'s', ' Des Voeux', ' Connaught', ' Catchick']

  function detectDistrict(text: string): { hkIsland: boolean; klnOrNT: boolean } {
    const t = text.toLowerCase()
    if (HK_ISLAND_STREETS.some((s) => t.includes(s))) return { hkIsland: true, klnOrNT: false }
    return { hkIsland: false, klnOrNT: true }
  }

  async function getQuote() {
    if (!picked) return setErr('Pick a time slot first')
    const address = [addressNo, addressName].filter(Boolean).join(' ')
    const district = detectDistrict(address)
    const me = customers.find((c) => c.username === (user.username ?? '').toLowerCase())
    try {
      const q = await API.previewQuote({
        startISO: picked.toISOString(), people, location: address, closestMtr: mtr,
        onHKIslandMTR: district.hkIsland, inKowloonOrNT: district.klnOrNT, requestTaxi: taxi,
        surcharge: me?.surcharge ?? 0, surchargeMode: me?.surchargeMode ?? 'addition',
      })
      setQuote({ ...q })
      setErr('')
    } catch (e: any) {
      setErr(e.message)
    }
  }

  async function acceptQuote() {
    if (!picked || !quote) return
    const b = await API.createBooking({
      telegramUserId: user.id,
      username: (user.username ?? '').toLowerCase(),
      name: user.name,
      phone: customers.find((c) => c.username === (user.username ?? '').toLowerCase())?.phone ?? '',
      address: [addressNo, addressName].filter(Boolean).join(' '),
      unit: customers.find((c) => c.username === (user.username ?? '').toLowerCase())?.unit ?? '',
      people, location: [addressNo, addressName].filter(Boolean).join(' ') + (mtr ? ` (MTR: ${mtr})` : ''),
      startISO: picked.toISOString(),
      quote,
    })
    setPicked(null); setQuote(null); setShowForm(false)
    setReceiptFor(b) // booking saved: pop up the receipt instructions
    onBooked()
  }

  // Receipt pop-up after admin accepts: client is asked to upload a transaction
  // receipt (photo) of the quoted amount, directly from the block.
  const [receiptFor, setReceiptFor] = useState<Booking | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Admin reviewing a client's uploaded receipt (pop-up with the image).
  const [reviewFor, setReviewFor] = useState<Booking | null>(null)

  // Admin accepting a taxi quote: prompts for the adjusted transport amount.
  const [adjustFor, setAdjustFor] = useState<Booking | null>(null)
  const [adjustedFare, setAdjustedFare] = useState('')

  // Client actions on their own block.
  async function uploadReceipt() {
    if (!receiptFor || !receiptFile) return
    const path = `booking-receipts/${receiptFor.id}-${Date.now()}-${receiptFile.name.replace(/[^\w.-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { upsert: true })
    if (upErr) { setErr(upErr.message); return }
    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    await API.submitReceipt(receiptFor.id, data?.publicUrl ?? '')
    setReceiptFor(null); setReceiptFile(null)
    onBooked()
  }

  async function cancelBooking(b: Booking) {
    await API.setBookingStatus(b.id, 'rejected')
    onBooked()
  }

  // Admin actions on a quoted booking (all from the block).
  async function adminAccept(b: Booking) {
    if (b.quote.option === 'B') { setAdjustFor(b); setAdjustedFare(''); return }
    await API.acceptQuote(b.id)
    onBooked()
  }

  async function adminAdjustConfirm() {
    if (!adjustFor) return
    const fare = Math.max(0, Math.round(Number(adjustedFare) || 0))
    await API.acceptQuote(adjustFor.id, fare)
    setAdjustFor(null)
    onBooked()
  }

  async function adminReject(b: Booking) {
    await API.setBookingStatus(b.id, 'rejected')
    onBooked()
  }

  async function adminConfirmReceipt(b: Booking) {
    await API.confirmReceipt(b.id)
    setReviewFor(null)
    onBooked()
  }

  async function adminRejectReceipt(b: Booking) {
    await API.rejectReceipt(b.id)
    setReviewFor(null)
    onBooked()
  }

  const hours = Array.from({ length: 24 }, (_, h) => h)
  const nowTop = isToday ? ((now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN) : null

  // Auto-scroll the grid so the current time block is at the top when opening the calendar.
  const gridWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isToday || nowTop === null || !gridWrapRef.current) return
    gridWrapRef.current.scrollTop = Math.max(nowTop - 8, 0)
  }, [isToday, nowTop])

  // Round "now" down to a 15-min block; an admin "not available" toggle flips
  // this block (and the rest of the current hour) to unavailable instantly.
  const nowBlock = useMemo(() => {
    const t = new Date(now); t.setSeconds(0, 0)
    t.setMinutes(Math.floor(t.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES)
    return t
  }, [now])

  return (
    <div className="calendar dayview">
      <div className="dayview-header">
        <button onClick={() => shiftDay(-1)}>‹ Prev</button>
        <button className="ghost" onClick={() => shiftDay(0)}>Today</button>
        <h2>{fmtDay(viewDate)}{isToday ? ' · Today' : ''}</h2>
        <button onClick={() => shiftDay(1)}>Next ›</button>
      </div>

      {isAdmin && <AvailabilityToggle nowBlock={nowBlock} onChanged={onBooked} />}

      <div className="dayview-grid-wrap" ref={gridWrapRef}>
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
            const isBlock = booking.status === 'blocked'
            // Phase of the quote-then-receipt flow:
            //   quoted    - yellow, everyone sees it, info only for admin/owner
            //   awaiting  - admin accepted, client must upload receipt (yellow)
            //   submitted - client uploaded receipt, admin must review (blue)
            //   confirmed - admin accepted the receipt: green to admin/owner,
            //               red block with no info for everyone else
            const isQuoted = booking.status === 'pending' && !booking.receiptStatus
            const isAwaiting = booking.status === 'accepted' && booking.receiptStatus === 'requested'
            const isSubmitted = booking.receiptStatus === 'submitted'
            const isConfirmed = booking.receiptStatus === 'confirmed'
            const mine = booking.telegramUserId === user.id || isAdmin
            const visible = mine || isQuoted || isAwaiting
            const phaseClass = isQuoted || isAwaiting ? 'status-quoted' : isSubmitted ? 'status-submitted' : isConfirmed ? (mine ? 'status-accepted' : 'status-hidden') : `status-${booking.status}`
            if (!visible && !isConfirmed) return null
            return (
              <div
                key={booking.id}
                className={`dayview-event ${phaseClass}`}
                style={{ top, height }}
                onClick={() => {
                  if (!mine) return
                  if (isQuoted && isAdmin) return // uses in-block buttons
                  if (isAwaiting && booking.telegramUserId === user.id) { setReceiptFor(booking); return }
                  if (isSubmitted && isAdmin) { setReviewFor(booking); return }
                }}
              >
                {isBlock ? (
                  <strong>🚫 Not available</strong>
                ) : !visible && isConfirmed ? (
                  // Confirmed booking seen by other clients: red block, nothing inside.
                  <strong>Unavailable</strong>
                ) : (
                  <>
                    <strong>{fmtHk(start)}–{fmtHk(end)}</strong>
                    <span>
                      {isQuoted ? '⏳ Quoted' : isAwaiting ? '🧾 Upload receipt' : isSubmitted ? '📨 Receipt under review' : isConfirmed ? '✅ Confirmed' : booking.status}
                      {' · '}{booking.people}p · {booking.quote.total} HKD
                    </span>

                    {/* Admin: decide the quote right on the block */}
                    {isQuoted && isAdmin && (
                      <span className="block-actions" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => adminAccept(booking)}>Accept</button>
                        <button className="danger" onClick={() => adminReject(booking)}>Reject</button>
                      </span>
                    )}

                    {/* Client: upload receipt or cancel, right on the block */}
                    {isAwaiting && booking.telegramUserId === user.id && (
                      <span className="block-actions" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setReceiptFor(booking)}>Upload transaction receipt</button>
                        <button className="danger" onClick={() => cancelBooking(booking)}>Cancel</button>
                      </span>
                    )}

                    {booking.telegramUserId === user.id && (
                      <a
                        href={gcalUrl(booking)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="gcal-link"
                      >📅 Add to Google Calendar</a>
                    )}
                  </>
                )}
              </div>
            )
          })}
          {picked && sameDay(picked, viewDate) && (
            <div
              className="dayview-picked"
              style={{ top: (picked.getHours() * 60 + picked.getMinutes()) * PX_PER_MIN, height: BOOKING_MS / 60000 * PX_PER_MIN }}
              onClick={(e) => e.stopPropagation()}
            >
              <span>Selected {fmtHk(picked)}–{fmtHk(new Date(picked.getTime() + BOOKING_MS))}</span>
              {/* Book button inside the selected timeslot */}
              {isAdmin
                ? <button onClick={(e) => { e.stopPropagation(); adminOccupy() }}>🚫 Mark not available</button>
                : <button onClick={(e) => { e.stopPropagation(); setShowForm(true) }}>Book this slot</button>}
            </div>
          )}
        </div>
      </div>
      <p className="dayview-hint">
        {isAdmin
          ? 'Tap a free slot, then "Mark not available" to block it. 15-min blocks, 1 hour per booking.'
          : 'Tap an empty slot, then "Book this slot". 15-min blocks, 1 hour per booking, min 1h ahead.'}
      </p>

      {/* Booking form as a pop-up modal instead of inline below the calendar */}
      {showForm && picked && !quote && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); getQuote() }}>
            <h3>Booking {picked.toLocaleString('en-HK')} (1 hour)</h3>
            <label className="field">
              <span className="field-label">Number of people</span>
              <input className="long" type="number" min={1} value={people} onChange={(e) => setPeople(+e.target.value)} placeholder="Number of people" required />
            </label>
            <label className="field duo">
              <span className="field-label">Street no / name</span>
              <span className="inputs">
                <input className="short" maxLength={6} placeholder="No." value={addressNo} onChange={(e) => setAddressNo(e.target.value)} required />
                <input className="long" placeholder="Street name" value={addressName} onChange={(e) => setAddressName(e.target.value)} required />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Closest MTR</span>
              <select className="long" value={mtr} onChange={(e) => {
                setMtr(e.target.value)
                // Taxi stays checked only if the newly selected MTR is not the
                // HK Island west-end exception.
                const night = isNightRate(picked ? (picked.getUTCHours() + 8) % 24 : new Date().getHours())
                setTaxi(night && !['Kennedy Town', 'HKU'].includes(e.target.value))
              }} required>
                <option value="" disabled>Select MTR station</option>
                {UNIQUE_MTR_STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Taxi</span>
              <input type="checkbox" checked={taxi} onChange={(e) => setTaxi(e.target.checked)} />
            </label>
            <button type="submit">Get Quote</button>
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Quote shown as a pop-up modal in the middle of the screen.
          Displayed simply as Service + Transport (x2 for 11pm-7:59am taxi). */}
      {quote && (
        <div className="modal-backdrop" onClick={() => setQuote(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Quote: {quote.total} {quote.currency}</h3>
            <p>
              Service: {quote.base + (quote.surcharge ?? 0)}{(quote.surcharge ?? 0) > 0 ? ' (incl. surcharge)' : ''}
              {' · '}
              Transport: {quote.taxiFare}{quote.option === 'B' ? ' (taxi x2)' : ''}
            </p>
            <p className="notice">{NON_REFUNDABLE_NOTICE}</p>
            <button onClick={acceptQuote}>Accept</button>
            <button type="button" onClick={() => { setQuote(null); setPicked(null); setShowForm(false) }}>Reject</button>
          </div>
        </div>
      )}
      {err && <p className="error">{err}</p>}

      {/* Receipt upload pop-up: shown after the admin accepted the quote.
          The client uploads a transaction receipt photo of the quoted amount
          directly here, or cancels the booking. */}
      {receiptFor && (
        <div className="modal-backdrop" onClick={() => setReceiptFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send payment receipt</h3>
            <p>
              Please upload a transaction receipt of <strong>{receiptFor.quote.total - (receiptFor.creditsUsed ?? 0)} HKD</strong> for your
              booking {fmtHk(new Date(receiptFor.startISO))}–{fmtHk(new Date(new Date(receiptFor.startISO).getTime() + BOOKING_MS))}
              {(receiptFor.creditsUsed ?? 0) > 0 && <> ({receiptFor.creditsUsed} HKD paid with credits, {receiptFor.quote.total - (receiptFor.creditsUsed ?? 0)} HKD to send)</>}.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              {receiptFile ? `📎 ${receiptFile.name}` : 'Choose receipt photo'}
            </button>
            <button onClick={uploadReceipt} disabled={!receiptFile}>Submit receipt</button>
            <button type="button" className="secondary" onClick={() => cancelBooking(receiptFor)}>Cancel booking</button>
          </div>
        </div>
      )}

      {/* Admin: adjust transport fare for a taxi quote before accepting */}
      {adjustFor && (
        <div className="modal-backdrop" onClick={() => setAdjustFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust transport</h3>
            <p>{adjustFor.name} · {adjustFor.quote.total} HKD total (taxi selected). Enter the adjusted transport amount.</p>
            <label className="field">
              <span className="field-label">Transport amount (HKD)</span>
              <input className="short" type="number" min={0} value={adjustedFare} onChange={(e) => setAdjustedFare(e.target.value)} autoFocus />
            </label>
            <button onClick={adminAdjustConfirm}>Accept</button>
            <button type="button" className="secondary" onClick={() => setAdjustFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Admin: review the client's uploaded receipt, accept or reject it */}
      {reviewFor && (
        <div className="modal-backdrop" onClick={() => setReviewFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Receipt review</h3>
            <p>{reviewFor.name} · {new Date(reviewFor.startISO).toLocaleString('en-HK')} · {reviewFor.quote.total} HKD</p>
            {reviewFor.receiptImageUrl
              ? <img src={reviewFor.receiptImageUrl} alt="Transaction receipt" style={{ maxWidth: '100%', borderRadius: 8 }} />
              : <p className="muted">No receipt image stored.</p>}
            <button onClick={() => adminConfirmReceipt(reviewFor)}>Accept</button>
            <button type="button" className="danger" onClick={() => adminRejectReceipt(reviewFor)}>Reject</button>
          </div>
        </div>
      )}

      {/* Admin: pending quoted bookings also listed below the grid for a quick
          overview (the decision itself happens on the calendar blocks). */}
      {isAdmin && (
        <div className="admin-queue">
          <h3>Pending quotes</h3>
          {bookings.filter((b) => b.status === 'pending' && !b.receiptStatus).length === 0 && <p className="muted">None.</p>}
          {bookings.filter((b) => b.status === 'pending' && !b.receiptStatus).map((b) => (
            <div key={b.id} className="booking">
              <span>{b.name} · {new Date(b.startISO).toLocaleString('en-HK')} · {b.people}p · {b.quote.total} HKD{b.quote.option === 'B' ? ' (taxi)' : ''}</span>
              <span className="booking-actions">
                <button onClick={() => adminAccept(b)}>Accept</button>
                <button className="danger" onClick={() => adminReject(b)}>Reject</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Admin-only toggle at the top of the user page: flips the current time slot
// (rest of the current hour) available / not available.
function AvailabilityToggle({ nowBlock, onChanged }: { nowBlock: Date; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'free' | 'busy' | null>(null)

  // Which state is the current hour in right now?
  useEffect(() => {
    let alive = true
    API.isHourBlocked(nowBlock).then((b) => { if (alive) setState(b ? 'busy' : 'free') }).catch(() => {})
    return () => { alive = false }
  }, [nowBlock])

  async function toggle() {
    if (busy || !state) return
    setBusy(true)
    try {
      if (state === 'free') {
        await API.blockCurrentHour(nowBlock)
        setState('busy')
      } else {
        await API.unblockCurrentHour(nowBlock)
        setState('free')
      }
      onChanged()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className={`availability-toggle ${state === 'busy' ? 'off' : 'on'}`}
      onClick={toggle}
      disabled={busy}
    >
      {state === 'busy' ? '🚫 Not available (tap to open current slot)' : '🟢 Available (tap to close current slot)'}
    </button>
  )
}
