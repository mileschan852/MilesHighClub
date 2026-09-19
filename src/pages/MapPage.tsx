import { useEffect, useRef, useState } from 'react'
import { API } from '../api'

// Map page.
// - Admins: always accessible. Shows the admin's own live location on an
//   OpenStreetMap embed (reliable, no external tile API key) and keeps saving
//   the location while the page is open.
// - Customers: unlocked only from 1 hour before an accepted booking until it
//   ends. Shows Miles' (admin's) last saved location.
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

  // Customer view: load the admin's last known location.
  useEffect(() => {
    if (!active || isAdmin) return
    API.getAdminLocation()
      .then(setPos)
      .catch((e: any) => setErr(e.message || 'Could not load location'))
  }, [active, isAdmin])

  // Admin view: device geolocation, saved to the DB (once per visit, retried if it failed).
  useEffect(() => {
    if (!active || !isAdmin) return
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
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

  // OpenStreetMap embed iframe: works reliably where the old static-map image
  // service timed out.
  const bbox = pos ? `${pos.lng - 0.005},${pos.lat - 0.003},${pos.lng + 0.005},${pos.lat + 0.003}` : ''
  const embed = pos
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pos.lat},${pos.lng}`
    : ''

  return (
    <div className="map">
      <h2>📍 {isAdmin ? 'Your location' : "Miles' location"}</h2>
      {err && <p className="error">{err}</p>}
      {pos ? (
        <>
          <iframe
            title="map"
            style={{ width: '100%', height: 320, border: 0, borderRadius: 12 }}
            src={embed}
          />
          <p>
            <small>
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              {pos.at && <> · Updated {new Date(pos.at).toLocaleTimeString('en-HK', { hour12: false })}</>}
            </small>
          </p>
          <p>
            <a href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}>Open in Google Maps</a>
          </p>
        </>
      ) : (
        !err && <p>Getting location…</p>
      )}
    </div>
  )
}
