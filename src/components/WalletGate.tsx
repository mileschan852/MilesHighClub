import { ReactNode, useEffect, useState } from 'react'
import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react'

// NFT gate: this stage only requires a connected TON wallet.
// Checking for the specific NFT collection comes later.
function Gate({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI()
  const [connected, setConnected] = useState(false)

  useEffect(() => tonConnectUI.onStatusChange((wallet) => setConnected(!!wallet)), [tonConnectUI])

  if (!connected) {
    return (
      <div className="gate">
        <p>Connect your wallet to enter the club.</p>
        <button onClick={() => tonConnectUI.openModal()}>Connect Wallet</button>
      </div>
    )
  }
  return <>{children}</>
}

export default function WalletGate({ children }: { children: ReactNode }) {
  const manifestUrl = `${window.location.origin}${window.location.pathname}tonconnect-manifest.json`
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <Gate>{children}</Gate>
    </TonConnectUIProvider>
  )
}
