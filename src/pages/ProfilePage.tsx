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
      <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} placeholder="Phone number" />
      <label className="field duo">
        <span className="field-label">Street no / name</span>
        <input className="short" value={info.streetNumber} onChange={(e) => setInfo({ ...info, streetNumber: e.target.value })} />
        <input className="long" value={info.streetName} onChange={(e) => setInfo({ ...info, streetName: e.target.value })} />
      </label>
      <label className="field duo">
        <span className="field-label">Unit / PassCode</span>
        <input className="half" value={info.unit} onChange={(e) => setInfo({ ...info, unit: e.target.value })} />
        <input className="half" value={info.passcode} onChange={(e) => setInfo({ ...info, passcode: e.target.value })} />
      </label>
      <p>Credits: {info.credits} (managed by Miles)</p>
      <button onClick={() => API.updateCustomer(info)}>Save</button>
    </div>
  )
}
