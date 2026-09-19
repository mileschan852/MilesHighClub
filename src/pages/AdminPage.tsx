import { Booking, CustomerInfo } from '../types'
import { API } from '../api'
import { useState } from 'react'

// Admin page: 3rd bottom-nav button. Shows the customer list with an
// "Add Customer" button on top (adds by Telegram @username). Tapping a
// customer shows their info with labeled inputs; surcharge is admin-only
// and is added to quotes.
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

  function field(label: string, value: string | number, onChange: (v: string) => void, type = 'text') {
    return (
      <label className="field">
        <span className="field-label">{label}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    )
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
          👤 {c.name} · {c.credits} credits · PassCode: {c.passcode || '-'} · Unit: {c.unit || '-'} · {c.streetNumber || '-'} {c.streetName || ''}{c.streetNumber || c.streetName ? ' St' : ''}
        </button>
      ))}

      {selected && (
        <div className="customer-editor">
          <h3>{selected.name}</h3>
          <p className="muted">Telegram: @{selected.username || selected.telegramUserId}</p>
          {field('Name', selected.name, (v) => setSelected({ ...selected, name: v }))}
          {field('Phone number', selected.phone, (v) => setSelected({ ...selected, phone: v }))}
          <label className="field duo">
            <span className="field-label">Street no / name</span>
            <span className="inputs">
              <input className="short" maxLength={6} placeholder="No." value={selected.streetNumber} onChange={(e) => setSelected({ ...selected, streetNumber: e.target.value })} />
              <input className="long" placeholder="Street name" value={selected.streetName} onChange={(e) => setSelected({ ...selected, streetName: e.target.value })} />
            </span>
          </label>
          <label className="field duo">
            <span className="field-label">Unit / PassCode</span>
            <span className="inputs">
              <input className="half" placeholder="Unit" value={selected.unit} onChange={(e) => setSelected({ ...selected, unit: e.target.value })} />
              <input className="half" placeholder="PassCode" value={selected.passcode} onChange={(e) => setSelected({ ...selected, passcode: e.target.value })} />
            </span>
          </label>
          {field('Credits', selected.credits, (v) => setSelected({ ...selected, credits: +v || 0 }), 'number')}
          {field('Surcharge (added to quote)', selected.surcharge, (v) => setSelected({ ...selected, surcharge: +v || 0 }), 'number')}
          <button onClick={async () => { await API.updateCustomer(selected); setSelected(null); onUpdate() }}>Save</button>
          <button onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
