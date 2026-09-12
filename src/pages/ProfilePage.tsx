import { useEffect, useState } from 'react'
import { CustomerInfo } from '../types'
import { API } from '../api'

export default function ProfilePage({ user }: { user: { id: number; name: string } }) {
  const [info, setInfo] = useState<CustomerInfo | null>(null)

  useEffect(() => {
    API.listCustomers().then((all) => setInfo(all.find((c) => c.telegramUserId === user.id) ?? {
      telegramUserId: user.id, name: user.name, phone: '', address: '', unit: '', credits: 0,
    }))
  }, [user.id])

  if (!info) return null

  return (
    <div className="profile">
      <h2>Your info</h2>
      <input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} placeholder="Phone number" />
      <input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="Address" />
      <input value={info.unit} onChange={(e) => setInfo({ ...info, unit: e.target.value })} placeholder="Unit number" />
      <p>Credits: {info.credits} (managed by Miles)</p>
      <button onClick={() => API.updateCustomer(info)}>Save</button>
    </div>
  )
}
