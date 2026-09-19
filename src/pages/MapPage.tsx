import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { API } from '../api'

// Map page.
// - Admins: always accessible. Shows the admin's own live location on an
//   in-app Leaflet map (OpenStreetMap tiles, no iframe, no Google) and keeps
//   saving the location while the page is open.
// - Customers: unlocked only from 1 hour before an accepted booking until it
//   ends. Shows Miles' (admin's) last saved location.
export default function MapPage({ bookings, isAdmin }: { bookings: { status: string; startISO: string }[]; isAdmin: boolean; username?: string }) {
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
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)

  // Customer view: load the admin's last known location.
  useEffect(() => {
    if (!active || isAdmin) return
    API.getAdminLocation()
      .then((p) => {
        if (p) setPos(p)
        else setErr('No location saved yet')
      })
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

  // Create the Leaflet map once we have a position.
  useEffect(() => {
    if (!active || !pos || mapRef.current || !mapDivRef.current) return
    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([pos.lat, pos.lng], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    L.circleMarker([pos.lat, pos.lng], { radius: 10, color: '#e53935', fillColor: '#e53935', fillOpacity: 0.9 }).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 200)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [active, !!pos])

  // Move the marker when the position updates.
  useEffect(() => {
    if (!mapRef.current || !pos) return
    mapRef.current.setView([pos.lat, pos.lng], mapRef.current.getZoom())
    if (markerRef.current) {
      markerRef.current.setLatLng([pos.lat, pos.lng])
    } else if (mapRef.current) {
      markerRef.current = L.circleMarker([pos.lat, pos.lng], { radius: 10, color: '#e53935', fillColor: '#e53935', fillOpacity: 0.9 }).addTo(mapRef.current)
    }
  }, [pos])

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
      <h2>📍 {isAdmin ? 'Your location' : "Miles' location"}</h2>
      {err && <p className="error">{err}</p>}
      {pos ? (
        <>
          <div
            ref={mapDivRef}
            style={{ width: '100%', height: 340, borderRadius: 12, background: '#dfe6e9' }}
          />
          <p>
            <small>
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              {pos.at && <> · Updated {new Date(pos.at).toLocaleTimeString('en-HK', { hour12: false })}</>}
            </small>
          </p>
        </>
      ) : (
        !err && <p>Getting location…</p>
      )}
    </div>
  )
}
