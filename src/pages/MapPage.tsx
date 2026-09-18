import { useEffect, useRef, useState } from 'react'
import { API } from '../api'

// Map page.
// - Admins: always accessible, shows the admin's own last known location on a
//   Leaflet map, and keeps it updated while the app is open (and on each visit).
// - Customers: unlocked only from 1 hour before an accepted booking until it ends.
export default function MapPage({ bookings, isAdmin, username }: { bookings: { status: string; startISO: string }[]; isAdmin: boolean; username?: string }) {
  const now = Date.now()
  const active =
    isAdmin ||
    bookings.some((b) => {
      if (b.status !== 'accepted') return false
      const start = new Date(b.startISO).getTime()
      return now >= start - 3600_000 && now <= start + 3600_000
    })

  const [pos, setPos] = useState<{ lat: number; lng: number; at: string } | null>(null)
  const [err, setErr] = useState('')
  const savedRef = useRef(false)

  useEffect(() => {
    if (!active || !isAdmin) return
    // Admin: get device location and save it as the admin's last known location.
    if (!('geolocation' in navigator)) { setErr('Geolocation not supported on this device'); return }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const at = new Date().toISOString()
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, at })
        if (!savedRef.current) {
          savedRef.current = true
          API.saveAdminLocation(p.coords.latitude, p.coords.longitude).catch((e: any) => console.warn('save location failed', e))
        }
      },
      (e) => setErr(e.message || 'Location permission denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [active, isAdmin])

  if (!active) {
    return (
      <div className="map greyed">
        <p>🗺️</p>
        <p>Map unlocks 1 hour before your accepted booking.</p>
      </div>
    )
  }

  return (
    <div className="map">
      <h2>📍 Last known location</h2>
      {err && <p className="error">{err}</p>}
      {pos ? (
        <>
          <p>
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            <br />
            <small>Updated {new Date(pos.at).toLocaleTimeString('en-HK', { hour12: false })}</small>
          </p>
          <img
            alt="map"
            style={{ width: '100%', borderRadius: 12 }}
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${pos.lat},${pos.lng}&zoom=16&size=480x320&markers=${pos.lat},${pos.lng},red`}
          />
          <p>
            <a href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}>Open in Google Maps</a>
          </p>
        </>
      ) : (
        !err && <p>Getting your location…</p>
      )}
    </div>
  )
}
