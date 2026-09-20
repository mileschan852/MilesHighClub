import { useEffect, useMemo, useState } from 'react'
import { CustomerInfo } from '../types'
import { API } from '../api'
import { UNIQUE_MTR_STATIONS, MTR_LINE_COLORS } from '../mtr'

export default function ProfilePage({ user, isAdmin }: { user: { id: number; name: string; username?: string }; isAdmin?: boolean }) {
  const [info, setInfo] = useState<CustomerInfo | null>(null)
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    API.listCustomers().then((all) => {
      const found = all.find((c) => c.username && c.username === (user.username ?? '').toLowerCase()) ?? {
        username: (user.username ?? '').toLowerCase(), name: user.name, phone: '', streetNumber: '', streetName: '', address: '', unit: '', passcode: '', credits: 0, surcharge: 0, closestMtr: '',
      }
      setInfo(found)
      setBaseline(JSON.stringify(found))
    })
  }, [user.username])

  // Save stays disabled until any field actually changed from the loaded state.
  const dirty = useMemo(() => !!info && JSON.stringify(info) !== baseline, [info, baseline])

  if (!info) return null

  return (
    <div className="profile">
      <h2>Your info</h2>
      {/* Name row: the name is only editable by admin (greyed out for clients);
          the Telegram username shows as a small label beside the Name label.
          Credits sit on the same line, right-aligned, 6 digits wide, and are
          admin-only too. */}
      <div className="field name-credits-row">
        <label className="field grow">
          <span className="field-label">Name {info.username && <span className="username-label">@{info.username}</span>}</span>
          <input className={isAdmin ? '' : 'readonly'} value={info.name ?? ''} onChange={(e) => setInfo({ ...info, name: e.target.value })} readOnly={!isAdmin} disabled={!isAdmin} />
        </label>
        <label className="field credits-field">
          <span className="field-label">Credits</span>
          <input type="text" className="credits-input" maxLength={6} value={info.credits} onChange={(e) => isAdmin ? setInfo({ ...info, credits: +e.target.value || 0 }) : undefined} readOnly={!isAdmin} disabled={!isAdmin} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Phone number</span>
        <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
      </label>
      <label className="field duo">
        <span className="field-label">Street no / name</span>
        <span className="inputs">
          <input className="short" maxLength={6} placeholder="No." value={info.streetNumber} onChange={(e) => setInfo({ ...info, streetNumber: e.target.value })} />
          <input className="long" placeholder="Street name" value={info.streetName} onChange={(e) => setInfo({ ...info, streetName: e.target.value })} />
        </span>
      </label>
      <label className="field">
        <span className="field-label">Closest MTR</span>
        <select value={info.closestMtr} onChange={(e) => setInfo({ ...info, closestMtr: e.target.value })}>
          <option value="">Select MTR station</option>
          {UNIQUE_MTR_STATIONS.map((s) => (
            <option key={s} value={s} style={{ color: MTR_LINE_COLORS[s] ?? '#eee', fontWeight: 'bold' }}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field duo">
        <span className="field-label">Unit / PassCode</span>
        <span className="inputs">
          <input className="half" placeholder="Unit" value={info.unit} onChange={(e) => setInfo({ ...info, unit: e.target.value })} />
          <input className="half" placeholder="PassCode" value={info.passcode} onChange={(e) => setInfo({ ...info, passcode: e.target.value })} />
        </span>
      </label>
      <button disabled={!dirty} onClick={async () => { await API.updateCustomer(info); setBaseline(JSON.stringify(info)) }}>Save</button>
    </div>
  )
}
