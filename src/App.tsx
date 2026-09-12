import { useEffect, useState } from 'react'
import { Booking, CustomerInfo, Page } from './types'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import WalletGate from './components/WalletGate'
import { API } from './api'

const ADMIN_TELEGRAM_ID = 1231127407 // Miles

export default function App() {
  const [page, setPage] = useState<Page>('calendar')
  const [user, setUser] = useState<{ id: number; name: string } | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [customers, setCustomers] = useState<CustomerInfo[]>([])

  useEffect(() => {
    API.getLogin().then(setUser)
  }, [])

  useEffect(() => {
    if (!user) return
    API.listBookings().then(setBookings)
    if (user.id === ADMIN_TELEGRAM_ID) API.listCustomers().then(setCustomers)
  }, [user])

  if (!user) return <div className="login">Logging in with Telegram...</div>

  const isAdmin = user.id === ADMIN_TELEGRAM_ID

  return (
    <div className="app">
      <WalletGate>
        {page === 'calendar' && <CalendarPage bookings={bookings} user={user} onBooked={() => API.listBookings().then(setBookings)} />}
        {page === 'map' && <MapPage bookings={bookings} />}
        {page === 'profile' && <ProfilePage user={user} />}
        {isAdmin && page === 'admin' && <AdminPage bookings={bookings} customers={customers} onUpdate={async () => {
          setBookings(await API.listBookings())
          setCustomers(await API.listCustomers())
        }} />}
        <nav className="bottom-nav">
          <button onClick={() => setPage('calendar')}>📅 Calendar</button>
          <button onClick={() => setPage('map')}>🗺️ Map</button>
          <button onClick={() => setPage('profile')}>👤 Info</button>
          {isAdmin && <button onClick={() => setPage('admin')}>🛠️ Admin</button>}
        </nav>
      </WalletGate>
    </div>
  )
}
