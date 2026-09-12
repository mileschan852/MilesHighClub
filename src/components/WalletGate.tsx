import { ReactNode, useState } from 'react'
import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react'

// NFT gate: this stage only requires a connected TON wallet.
// Checking for the specific NFT collection comes later.
function Gate({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI()
  const [connected, setConnected] = useState(!!tonConnectUI?.account)

  useEffectBind(tonConnectUI, setConnected)

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

function useEffectBind(tonConnectUI: any, setConnected: (v: boolean) => void) {
  const onChange = () => setConnected(!!tonConnectUI?.account)
  // subscribe once
  import('@tonconnect/ui-react').then((m) => {
    tonConnectUI?.onStatusChange?.(onChange)
  })
}

export default function WalletGate({ children }: { children: ReactNode }) {
  const manifestUrl = (import.meta as any).env.VITE_TONCONNECT_MANIFEST as string
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <Gate>{children}</Gate>
    </TonConnectUIProvider>
  )
}
