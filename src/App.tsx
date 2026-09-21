import { useEffect, useState } from 'react'
import { Booking, CustomerInfo, Page } from './types'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import ItemsPage from './pages/ItemsPage'
import AdminPage from './pages/AdminPage'
import WalletGate from './components/WalletGate'
import { API } from './api'

// Admin access: these Telegram usernames (case-insensitive) unlock admin mode.
const ADMIN_USERNAMES = ['mileschan852', 'hkmembersonly']

export default function App() {
  const [page, setPage] = useState<Page>('calendar')
  const [user, setUser] = useState<{ id: number; name: string; username?: string } | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<CustomerInfo[]>([])
  const [adminPos, setAdminPos] = useState<{ lat: number; lng: number; at: string } | null>(null)

  useEffect(() => {
    API.getLogin().then(setUser).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('login failed:', msg)
      setLoginError(msg || 'Unknown login error')
    })
  }, [])

  const isAdmin =
    !!user && ADMIN_USERNAMES.includes((user.username ?? '').toLowerCase())

  useEffect(() => {
    if (!user) return
    API.listBookings().then(setBookings).catch((e: unknown) => {
      console.error('bookings load failed:', e instanceof Error ? e.message : e)
    })
    // Everyone needs the customer list: it is the calendar gate for non-admins.
    API.listCustomers().then(setCustomers).catch((e: unknown) => {
      console.error('customers load failed:', e instanceof Error ? e.message : e)
      setLoginError('Could not load your account data: ' + (e instanceof Error ? e.message : String(e)))
    })
  }, [user, isAdmin])

  // Admin background location tracking: starts at login, keeps running while
  // the app is open (even off the map page), and saves to the DB at most once
  // a minute. The latest position is handed to the map page instantly.
  useEffect(() => {
    if (!user || !isAdmin) return
    if (!('geolocation' in navigator)) return
    let lastSave = 0
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setAdminPos({ lat: p.coords.latitude, lng: p.coords.longitude, at: new Date().toISOString() })
        const now = Date.now()
        if (now - lastSave > 60_000) {
          lastSave = now
          API.saveAdminLocation(p.coords.latitude, p.coords.longitude).catch(() => {})
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [user, isAdmin])

  if (!user) return loginError
    ? <div className="login">⚠️ Login failed: {loginError}<br /><br />Fully close and reopen the app in Telegram, then retry.</div>
    : <div className="login">Logging in with Telegram...</div>

  // Calendar is gated: only admins and customers present on the admin's list (matched by @username) may enter.
  // A user not on the list is kept on the loading page with no nav, unable to proceed.
  const canEnterCalendar = isAdmin || customers.some((c) => c.username && c.username === (user.username ?? '').toLowerCase())

  if (!canEnterCalendar) {
    return (
      <div className="app">
        <div className="login">Loading...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <WalletGate>
        {isAdmin && page === 'customers' && <AdminPage customers={customers} bookings={bookings} onUpdate={async () => {
          setCustomers(await API.listCustomers())
        }} />}
        {page === 'calendar' && (
          canEnterCalendar ? (
            <CalendarPage bookings={bookings} user={user} isAdmin={isAdmin} customers={customers} onBooked={() => API.listBookings().then(setBookings)} />
          ) : (
            <div className="locked">
              <h2>🔒 Calendar locked</h2>
              <p>Only registered customers can view the calendar. Contact Miles to be added.</p>
            </div>
          )
        )}
        {page === 'map' && <MapPage bookings={bookings} isAdmin={isAdmin} username={user.username} adminPos={adminPos} />}
        {page === 'items' && <ItemsPage username={user.username} />}
        {page === 'profile' && <ProfilePage user={user} isAdmin={isAdmin} />}
        <nav className="bottom-nav">
          <button className={page === 'calendar' ? 'active' : ''} onClick={() => setPage('calendar')}>📅 Calendar</button>
          <button className={page === 'map' ? 'active' : ''} onClick={() => setPage('map')}>🗺️ Map</button>
          {/* Items sits before the clients list; greyed out for clients whose
              admin has not checked "show items" (admins always get access) */}
          <button
            className={page === 'items' ? 'active' : ''}
            disabled={!isAdmin && !customers.some((c) => c.username === (user.username ?? '').toLowerCase() && c.showItems)}
            onClick={() => setPage('items')}
          >🛒 Items</button>
          {isAdmin
            ? <button className={page === 'customers' ? 'active' : ''} onClick={() => setPage('customers')}>👥 Clients</button>
            : <button className={page === 'profile' ? 'active' : ''} onClick={() => setPage('profile')}>👤 Info</button>}
        </nav>
      </WalletGate>
    </div>
  )
}
