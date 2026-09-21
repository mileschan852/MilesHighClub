import { Booking, CustomerInfo, ItemOrder } from '../types'
import { API } from '../api'
import { UNIQUE_MTR_STATIONS, MTR_LINE_COLORS } from '../mtr'
import { useEffect, useMemo, useState } from 'react'

// Admin page: 3rd bottom-nav button. Two tabs: Clients (list + editor modal)
// and Orders (item orders with receipts). Tapping a customer opens their info
// in a centered pop-up modal; surcharge is admin-only and is added to quotes.
export default function AdminPage({ customers, bookings, onUpdate }: {
  customers: CustomerInfo[]
  bookings: Booking[]
  onUpdate: () => void
}) {
  const [tab, setTab] = useState<'clients' | 'orders'>('clients')
  const [orders, setOrders] = useState<ItemOrder[]>([])
  const [orderDetail, setOrderDetail] = useState<ItemOrder | null>(null)
  const [selected, setSelected] = useState<CustomerInfo | null>(null)
  const [baseline, setBaseline] = useState('')
  // Save stays disabled until any field actually changed from the loaded state.
  const dirty = useMemo(() => !!selected && JSON.stringify(selected) !== baseline, [selected, baseline])
  useEffect(() => { setBaseline(JSON.stringify(selected)) }, [selected?.username])
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [err, setErr] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Load orders when the Orders tab opens.
  useEffect(() => {
    if (tab === 'orders') API.listItemOrders().then(setOrders).catch((e: any) => setErr(e.message))
  }, [tab])

  async function completeOrder(id: string) {
    try {
      await API.completeItemOrder(id)
      setOrders((o) => o.filter((x) => x.id !== id))
      setOrderDetail(null)
    } catch (e: any) {
      setErr(e.message)
    }
  }

  // Alphabetical by name (fallback to username for unnamed rows).
  const sorted = useMemo(
    () => [...customers].sort((a, b) => {
      const ka = (a.name || a.username || '').toLowerCase()
      const kb = (b.name || b.username || '').toLowerCase()
      return ka.localeCompare(kb)
    }),
    [customers],
  )

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

  async function removeCustomer() {
    if (!selected) return
    try {
      await API.removeCustomer(selected.username)
      setSelected(null)
      setConfirmRemove(false)
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

  const address = [selected?.streetNumber, selected?.streetName].filter(Boolean).join(' ')

  return (
    <div className="admin">
      {/* Clients / Orders switcher */}
      <div className="admin-tabs">
        <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>👥 Clients</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>📦 Orders</button>
      </div>
      {tab === 'orders' ? (
        <div className="orders-list">
          {orders.length === 0 && <p className="muted">No item orders.</p>}
          {orders.map((o) => (
            <button key={o.id} className="customer-row" onClick={() => setOrderDetail(o)}>
              <span className="row-line">
                <span className="row-left"><strong>{o.username}</strong></span>
                <span className="row-right item-price">${o.total}</span>
              </span>
              <span className="row-line">
                <span className="row-left muted">{o.items.join(', ')}</span>
                <span className="row-right muted">{new Date(o.createdAt).toLocaleString('en-HK')}</span>
              </span>
            </button>
          ))}
          {orderDetail && (
            <div className="modal-backdrop" onClick={() => setOrderDetail(null)}>
              <div className="modal customer-editor" onClick={(e) => e.stopPropagation()}>
                <h3>Order - @{orderDetail.username}</h3>
                <ul className="order-items">{orderDetail.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                <p className="order-total">Total: <span className="item-price">${orderDetail.total}</span></p>
                {orderDetail.receiptUrl && (
                  <a href={orderDetail.receiptUrl} target="_blank" rel="noreferrer">View receipt</a>
                )}
                <button onClick={() => completeOrder(orderDetail.id)}>Complete (delete order)</button>
                <button className="secondary" onClick={() => setOrderDetail(null)}>Close</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
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
      {sorted.map((c) => {
        const mtrColor = MTR_LINE_COLORS[c.closestMtr ?? '']
        return (
          <button key={c.username || c.telegramUserId} className="customer-row" onClick={() => setSelected({ ...c })}>
            <span className="row-line">
              <span className="row-left"><strong>{c.name}</strong> · PassCode: {c.passcode || '-'}</span>
              {c.closestMtr && (
                <span className="row-right mtr-station" style={mtrColor ? { color: mtrColor, fontWeight: 'bold' } : undefined}>
                  {c.closestMtr}
                </span>
              )}
            </span>
            <span className="row-line">
              <span className="row-left">{[c.unit, c.streetNumber, c.streetName].filter(Boolean).join(' ') || '-'}</span>
            </span>
          </button>
        )
      })}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal customer-editor" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.name}</h3>
            <div className="field name-credits-row">
              <label className="field grow">
                <span className="field-label">Name {selected.username && <span className="username-label">@{selected.username}</span>}</span>
                <input value={selected.name ?? ''} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              </label>
              <label className="field credits-field">
                <span className="field-label">Credits</span>
                <input type="text" className="credits-input" maxLength={6} value={selected.credits} onChange={(e) => setSelected({ ...selected, credits: +e.target.value || 0 })} />
              </label>
            </div>
            {field('Phone number', selected.phone, (v) => setSelected({ ...selected, phone: v }))}
            <label className="field duo">
              <span className="field-label">Street no / name</span>
              <span className="inputs">
                <input className="short" maxLength={6} placeholder="No." value={selected.streetNumber} onChange={(e) => setSelected({ ...selected, streetNumber: e.target.value })} />
                <input className="long" placeholder="Street name" value={selected.streetName} onChange={(e) => setSelected({ ...selected, streetName: e.target.value })} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Closest MTR</span>
              <select value={selected.closestMtr} onChange={(e) => setSelected({ ...selected, closestMtr: e.target.value })}>
                <option value="">Select MTR station</option>
                {UNIQUE_MTR_STATIONS.map((s) => (
                  <option key={s} value={s} style={{ color: MTR_LINE_COLORS[s] ?? '#eee', fontWeight: 'bold' }}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field duo">
              <span className="field-label">Unit / PassCode</span>
              <span className="inputs">
                <input className="half" placeholder="Unit" value={selected.unit} onChange={(e) => setSelected({ ...selected, unit: e.target.value })} />
                <input className="half" placeholder="PassCode" value={selected.passcode} onChange={(e) => setSelected({ ...selected, passcode: e.target.value })} />
              </span>
            </label>
            {/* Surcharge amount + type share one line, type right after amount */}
            <label className="field duo">
              <span className="field-label">Surcharge/type</span>
              <span className="inputs">
                <input className="short" type="number" value={selected.surcharge} onChange={(e) => setSelected({ ...selected, surcharge: +e.target.value || 0 })} />
                <select className="long" value={selected.surchargeMode ?? 'addition'} onChange={(e) => setSelected({ ...selected, surchargeMode: e.target.value as CustomerInfo['surchargeMode'] })}>
                  <option value="per_person">/person</option>
                  <option value="addition">Addition</option>
                  <option value="fixed">Fixed</option>
                </select>
              </span>
            </label>
            {/* Show items: when off, the Items page is greyed out for this user */}
            <label className="field show-items-field">
              <span className="field-label">Show items</span>
              <input type="checkbox" checked={selected.showItems} onChange={(e) => setSelected({ ...selected, showItems: e.target.checked })} />
            </label>
            {confirmRemove && (
              <div className="confirm-remove">
                <span className="muted">Remove {selected.name}{address ? ` (${address})` : ''}? This deletes the user.</span>
                <button className="danger" onClick={removeCustomer}>Confirm remove</button>
              </div>
            )}
            {/* Remove (left) and Save (right) share one line, each 1/4 width. */}
            <div className="modal-actions">
              <button className="danger" onClick={() => setConfirmRemove(true)}>Remove user</button>
              <button disabled={!dirty} onClick={async () => { await API.updateCustomer(selected); setBaseline(JSON.stringify(selected)); setSelected(null); onUpdate() }}>Save</button>
            </div>
            <button className="secondary" onClick={() => { setSelected(null); setConfirmRemove(false) }}>Close</button>
          </div>
        </div>
      )}
      {err && <p className="error">{err}</p>}
        </>
      )}
    </div>
  )
}
