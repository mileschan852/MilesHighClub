import { Booking, CustomerInfo } from '../types'
import { API } from '../api'
import { useState } from 'react'

// Admin page: 3rd bottom-nav button. Shows the customer list with an
// "Add Customer" button on top (adds by Telegram @username). Tapping a
// customer shows their info.
export default function AdminPage({ customers, onUpdate }: {
  customers: CustomerInfo[]
  onUpdate: () => void
}) {
  const [selected, setSelected] = useState<CustomerInfo | null>(null)
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [err, setErr] = useState('')

  function normalizeUsername(raw: string) {
    return raw.trim().replace(/^@/, '').toLowerCase()
  }

  async function addCustomer() {
    const username = normalizeUsername(newUsername)
    if (!/^[a-z0-9_]{4,32}$/.test(username)) return setErr('Enter a valid Telegram @username (letters, numbers, underscores)')
    if (customers.some((c) => c.username === username)) return setErr('That customer is already on the list')
    try {
      await API.addCustomer(username)
      setAdding(false)
      setNewUsername('')
      setErr('')
      onUpdate()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  return (
    <div className="admin">
      <h2>Customers</h2>
      {!adding && <button className="add-customer" onClick={() => setAdding(true)}>➕ Add Customer</button>}
      {adding && (
        <div className="customer-editor">
          <h3>Add Customer</h3>
          <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="@username (e.g. @ johndoe)" />
          <button onClick={addCustomer}>Save</button>
          <button onClick={() => { setAdding(false); setErr('') }}>Cancel</button>
        </div>
      )}
      {customers.length === 0 && !adding && <p className="muted">No customers yet. Add one with their Telegram @username.</p>}
      {customers.map((c) => (
        <button key={c.username || c.telegramUserId} className="customer-row" onClick={() => setSelected({ ...c })}>
          👤 {c.name} · {c.credits} credits
        </button>
      ))}

      {selected && (
        <div className="customer-editor">
          <h3>{selected.name}</h3>
          <p className="muted">Telegram: @{selected.username || selected.telegramUserId}</p>
          <input value={selected.phone} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} placeholder="Phone" />
          <input value={selected.address} onChange={(e) => setSelected({ ...selected, address: e.target.value })} placeholder="Address" />
          <input value={selected.unit} onChange={(e) => setSelected({ ...selected, unit: e.target.value })} placeholder="Unit" />
          <input type="number" value={selected.credits} onChange={(e) => setSelected({ ...selected, credits: +e.target.value })} placeholder="Credits" />
          <button onClick={async () => { await API.updateCustomer(selected); setSelected(null); onUpdate() }}>Save</button>
          <button onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
