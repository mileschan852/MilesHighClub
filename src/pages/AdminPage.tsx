import { Booking, CustomerInfo } from '../types'
import { API } from '../api'
import { useState } from 'react'

// Admin (Miles): bookings on a calendar with accept/reject, and a customer list
// where tapping a customer reveals editable info and credits.
export default function AdminPage({ bookings, customers, onUpdate }: {
  bookings: Booking[]
  customers: CustomerInfo[]
  onUpdate: () => void
}) {
  const [selected, setSelected] = useState<CustomerInfo | null>(null)

  async function decide(id: string, status: 'accepted' | 'rejected') {
    await API.setBookingStatus(id, status)
    onUpdate()
  }

  async function saveCustomer(c: CustomerInfo) {
    await API.updateCustomer(c)
    setSelected(null)
    onUpdate()
  }

  return (
    <div className="admin">
      <h2>Bookings</h2>
      {bookings.map((b) => (
        <div key={b.id} className={`booking ${b.status}`}>
          <span>{new Date(b.startISO).toLocaleString('en-HK')} · {b.name} · {b.people}p · {b.quote.total} HKD</span>
          {b.status === 'pending' ? (
            <>
              <button onClick={() => decide(b.id, 'accepted')}>Accept</button>
              <button onClick={() => decide(b.id, 'rejected')}>Reject</button>
            </>
          ) : (
            <span>{b.status}</span>
          )}
        </div>
      ))}

      <h2>Customers</h2>
      {customers.map((c) => (
        <button key={c.telegramUserId} onClick={() => setSelected({ ...c })}>
          {c.name} · {c.credits} credits
        </button>
      ))}

      {selected && (
        <div className="customer-editor">
          <h3>{selected.name}</h3>
          <input value={selected.phone} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} placeholder="Phone" />
          <input value={selected.address} onChange={(e) => setSelected({ ...selected, address: e.target.value })} placeholder="Address" />
          <input value={selected.unit} onChange={(e) => setSelected({ ...selected, unit: e.target.value })} placeholder="Unit" />
          <input type="number" value={selected.credits} onChange={(e) => setSelected({ ...selected, credits: +e.target.value })} placeholder="Credits" />
          <button onClick={() => saveCustomer(selected)}>Save</button>
          <button onClick={() => setSelected(null)}>Cancel</button>
        </div>
      )}
    </div>
  )
}
