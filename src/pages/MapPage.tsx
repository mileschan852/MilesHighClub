import { Booking } from '../types'

// Map page: shows Miles' last known location to the user, but ONLY during the window
// from 1 hour before an accepted booking until the booking ends. Greyed out otherwise.
export default function MapPage({ bookings }: { bookings: Booking[] }) {
  const now = Date.now()
  const active = bookings.some((b) => {
    if (b.status !== 'accepted') return false
    const start = new Date(b.startISO).getTime()
    return now >= start - 3600_000 && now <= start + 3600_000
  })

  if (!active) {
    return (
      <div className="map greyed">
        <p>🗺️</p>
        <p>Map unlocks 1 hour before your accepted booking.</p>
      </div>
    )
  }
  // Live map of Miles' last known location, fetched from /api/location
  return (
    <div className="map">
      {/* iframe/embed of live location goes here in a later milestone */}
      <p>Live map is available during your booking window.</p>
    </div>
  )
}
