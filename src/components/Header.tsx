import { ConnectButton } from '@rainbow-me/rainbowkit'

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <defs>
        <linearGradient id="coin" x1="4" y1="3" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E3A26D" />
          <stop offset="1" stopColor="#B5652E" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="12" fill="url(#coin)" />
      <circle cx="14" cy="14" r="8.5" stroke="#12101B" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M14 8.8v10.4M11.6 11.4c0-1 1-1.6 2.4-1.6s2.4.6 2.4 1.7c0 2.3-4.8 1.1-4.8 3.5 0 1.1 1.1 1.8 2.4 1.8s2.4-.7 2.4-1.8" stroke="#12101B" strokeOpacity="0.75" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5">
      <div className="flex items-center gap-2.5">
        <Mark />
        <span className="font-display text-xl font-medium tracking-tight text-cream">PennyOracle</span>
      </div>
      <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
    </header>
  )
}
