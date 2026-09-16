import { Booking, CustomerInfo } from '../types'
import { API } from '../api'
import { useState } from 'react'

// Admin page: 3rd bottom-nav button. Shows the customer list with an
// "Add Customer" button on top (adds by Telegram user id). Tapping a
// customer shows their info.
export default function AdminPage({ customers, onUpdate }: {
  customers: CustomerInfo[]
  onUpdate: () => void
}) {
  const [selected, setSelected] = useState<CustomerInfo | null>(null)
  const [adding, setAdding] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [err, setErr] = useState('')

  async function addCustomer() {
    const id = Number(newId)
    if (!id || id <= 0) return setErr('Enter a valid Telegram user id (numbers only)')
    if (customers.some((c) => c.telegramUserId === id)) return setErr('That customer is already on the list')
    try {
      await API.updateCustomer({ telegramUserId: id, name: newName.trim() || `Customer ${id}`, phone: '', address: '', unit: '', credits: 0 })
      setAdding(false)
      setNewId('')
      setNewName('')
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
          <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Telegram user id (e.g. 123456789)" inputMode="numeric" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (optional)" />
          <button onClick={addCustomer}>Save</button>
          <button onClick={() => { setAdding(false); setErr('') }}>Cancel</button>
        </div>
      )}
      {customers.length === 0 && !adding && <p className="muted">No customers yet. Add one with their Telegram user id.</p>}
      {customers.map((c) => (
        <button key={c.telegramUserId} className="customer-row" onClick={() => setSelected({ ...c })}>
          👤 {c.name} · id {c.telegramUserId} · {c.credits} credits
        </button>
      ))}

      {selected && (
        <div className="customer-editor">
          <h3>{selected.name}</h3>
          <p className="muted">Telegram id: {selected.telegramUserId}</p>
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
