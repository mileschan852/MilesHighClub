import { useEffect, useState } from 'react'
import { Booking, CustomerInfo, Page } from './types'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import WalletGate from './components/WalletGate'
import { API } from './api'

// Admin access: these Telegram usernames (case-insensitive) unlock admin mode.
const ADMIN_USERNAMES = ['mileschan852', 'hkmemberonly']
const ADMIN_IDS: number[] = []

export default function App() {
  const [page, setPage] = useState<Page>('calendar')
  const [user, setUser] = useState<{ id: number; name: string; username?: string } | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<CustomerInfo[]>([])

  useEffect(() => {
    API.getLogin().then(setUser)
  }, [])

  const isAdmin =
    !!user && (ADMIN_IDS.includes(user.id) || ADMIN_USERNAMES.includes((user.username ?? '').toLowerCase()))

  useEffect(() => {
    if (!user) return
    API.listBookings().then(setBookings)
    if (isAdmin) API.listCustomers().then(setCustomers)
  }, [user, isAdmin])

  if (!user) return <div className="login">Logging in with Telegram...</div>

  // Calendar is gated: only admins and customers present on the admin's list may enter.
  const canEnterCalendar = isAdmin || customers.some((c) => c.telegramUserId === user.id)

  return (
    <div className="app">
      <WalletGate>
        {isAdmin && page === 'customers' && <AdminPage customers={customers} onUpdate={async () => {
          setCustomers(await API.listCustomers())
        }} />}
        {page === 'calendar' && (
          canEnterCalendar ? (
            <CalendarPage bookings={bookings} user={user} onBooked={() => API.listBookings().then(setBookings)} />
          ) : (
            <div className="locked">
              <h2>🔒 Calendar locked</h2>
              <p>Only registered customers can view the calendar. Contact Miles to be added.</p>
            </div>
          )
        )}
        {page === 'map' && <MapPage bookings={bookings} />}
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
