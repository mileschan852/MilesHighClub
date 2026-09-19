import { useEffect, useState } from 'react'
import { CustomerInfo } from '../types'
import { API } from '../api'

export default function ProfilePage({ user }: { user: { id: number; name: string; username?: string } }) {
  const [info, setInfo] = useState<CustomerInfo | null>(null)

  useEffect(() => {
    API.listCustomers().then((all) => setInfo(all.find((c) => c.username && c.username === (user.username ?? '').toLowerCase()) ?? {
      username: (user.username ?? '').toLowerCase(), name: user.name, phone: '', streetNumber: '', streetName: '', address: '', unit: '', passcode: '', credits: 0, surcharge: 0,
    }))
  }, [user.username])

  if (!info) return null

  return (
    <div className="profile">
      <h2>Your info</h2>
      <label className="field">
        <span className="field-label">Name</span>
        <input value={info.name ?? ''} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
      </label>
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
      <label className="field duo">
        <span className="field-label">Unit / PassCode</span>
        <span className="inputs">
          <input className="half" placeholder="Unit" value={info.unit} onChange={(e) => setInfo({ ...info, unit: e.target.value })} />
          <input className="half" placeholder="PassCode" value={info.passcode} onChange={(e) => setInfo({ ...info, passcode: e.target.value })} />
        </span>
      </label>
      <p>{info.credits} credits left</p>
      <button onClick={() => API.updateCustomer(info)}>Save</button>
    </div>
  )
}
