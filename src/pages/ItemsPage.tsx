import { useMemo, useRef, useState } from 'react'
import { API } from '../api'

// 🧊 quantity doubles from 3.5 up to 28; price drops by 100 each double up
// (3.5 → $700, 7 → $600, 14 → $500, 28 → $400).
const ICE_TIERS = [
  { qty: 3.5, price: 700 },
  { qty: 7, price: 600 },
  { qty: 14, price: 500 },
  { qty: 28, price: 400 },
]

// Fixed-price items: checkbox adds the price to the total.
const FIXED_ITEMS = [
  { emoji: '💙', label: '💙 x4', price: 250 },
  { emoji: '😴', label: '😴 x10', price: 250 },
  { emoji: '💉', label: '💉 x100', price: 250 },
  { emoji: '🏦', label: 'Prepay 1050', price: 1000 },
  { emoji: '🏦', label: 'Prepay 3300', price: 3000 },
]

export default function ItemsPage({ username = '' }: { username?: string }) {
  const [iceTier, setIceTier] = useState(ICE_TIERS[0].qty)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const total = useMemo(() => {
    let t = 0
    if (checked.ice) t += ICE_TIERS.find((i) => i.qty === iceTier)?.price ?? 0
    FIXED_ITEMS.forEach((it, i) => { if (checked['f' + i]) t += it.price })
    return t
  }, [checked, iceTier])

  const anyChecked = total > 0

  const toggle = (k: string) => setChecked((c) => ({ ...c, [k]: !c[k] }))

  const submit = () => {
    if (!anyChecked || submitting) return
    setError(null)
    // Ask the OS file picker for the receipt image; the order is recorded on
    // file selection (handleSubmit below).
    fileRef.current?.click()
  }

  const handleSubmitFile = async (file: File) => {
    setSubmitting(true)
    try {
      const items: string[] = []
      if (checked.ice) items.push(`🧊 x${iceTier}`)
      FIXED_ITEMS.forEach((it, i) => { if (checked['f' + i]) items.push(it.label) })
      const url = await API.uploadItemReceipt(username, items, total, file)
      setDone(`Order submitted: ${items.join(', ')} = $${total}. Receipt received, Miles will confirm shortly.`)
      setChecked({})
      void url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="items-page">
      <h2>Items</h2>
      {done && <div className="items-done">{done}</div>}
      <label className="item-row">
        <input type="checkbox" checked={!!checked.ice} onChange={() => toggle('ice')} />
        <span className="item-emoji">🧊</span>
        <select
          className="item-qty"
          value={iceTier}
          disabled={!checked.ice}
          onChange={(e) => setIceTier(Number(e.target.value))}
        >
          {ICE_TIERS.map((t) => (
            <option key={t.qty} value={t.qty}>x{t.qty}</option>
          ))}
        </select>
        <span className="item-price">${checked.ice ? (ICE_TIERS.find((i) => i.qty === iceTier)?.price ?? 0) : ICE_TIERS.find((i) => i.qty === iceTier)?.price}</span>
      </label>
      {FIXED_ITEMS.map((it, i) => (
        <label className="item-row" key={i}>
          <input type="checkbox" checked={!!checked['f' + i]} onChange={() => toggle('f' + i)} />
          <span className="item-emoji">{it.emoji}</span>
          <span className="item-label">{it.label}</span>
          <span className="item-price">${it.price}</span>
        </label>
      ))}
      <div className="items-total">
        <span>Total</span>
        <span className="item-price">${total}</span>
      </div>
      {error && <div className="items-error">⚠️ {error}</div>}
      <button className="items-upload" disabled={!anyChecked || submitting} onClick={submit}>
        {submitting ? 'Uploading...' : 'Upload transaction receipt'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleSubmitFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
