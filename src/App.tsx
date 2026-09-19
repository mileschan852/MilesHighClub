import { useEffect, useState } from 'react'
import { Booking, CustomerInfo, Page } from './types'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
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
    API.listBookings().then(setBookings)
    if (isAdmin) API.listCustomers().then(setCustomers)
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
        {isAdmin && page === 'customers' && <AdminPage customers={customers} onUpdate={async () => {
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
        {page === 'map' && <MapPage bookings={bookings} isAdmin={isAdmin} username={user.username} />}
        {page === 'profile' && <ProfilePage user={user} />}
        <nav className="bottom-nav">
          <button onClick={() => setPage('calendar')}>📅 Calendar</button>
          <button onClick={() => setPage('map')}>🗺️ Map</button>
          {isAdmin
            ? <button onClick={() => setPage('customers')}>👥 Customers</button>
            : <button onClick={() => setPage('profile')}>👤 Info</button>}
        </nav>
      </WalletGate>
    </div>
  )
}
