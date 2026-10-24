import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import type { AskPhase } from '@/hooks/useAsk'
import { appChain, txUrl } from '@/lib/chain'

interface Props {
  phase: AskPhase
  hash: `0x${string}` | null
  error: string | null
  success: string | null
  watchId: number | null
}

function Row({ children, tone }: { children: React.ReactNode; tone: 'busy' | 'ok' | 'error' | 'wait' }) {
  const color =
    tone === 'error' ? 'text-[#F0A3A3]' : tone === 'ok' ? 'text-copper-300' : tone === 'wait' ? 'text-gold-300' : 'text-cream/90'
  return <div className={`flex items-center justify-center gap-2 text-sm ${color}`}>{children}</div>
}

function TxLink({ hash }: { hash: `0x${string}` | null }) {
  const href = hash ? txUrl(hash) : undefined
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-mist underline-offset-4 hover:text-cream hover:underline"
    >
      View transaction <ExternalLink className="size-3" />
    </a>
  )
}

export function StatusLine({ phase, hash, error, success, watchId }: Props) {
  return (
    <div className="mt-5 flex min-h-6 flex-col items-center gap-2" aria-live="polite">
      {phase === 'switching' && (
        <Row tone="busy">
          <Loader2 className="size-4 animate-spin" /> Switching to {appChain.name}. Confirm in your wallet.
        </Row>
      )}
      {phase === 'approving' && (
        <Row tone="busy">
          <Loader2 className="size-4 animate-spin" />
          {hash ? 'Approving 0.01 USDC. Confirming onchain.' : 'Approving 0.01 USDC. Confirm in your wallet.'}
          <TxLink hash={hash} />
        </Row>
      )}
      {phase === 'asking' && (
        <Row tone="busy">
          <Loader2 className="size-4 animate-spin" />
          {hash ? 'Asking the Oracle. Confirming onchain.' : 'Asking the Oracle. Confirm in your wallet.'}
          <TxLink hash={hash} />
        </Row>
      )}
      {success && (
        <Row tone="ok">
          <CheckCircle2 className="size-4" /> {success}
          {phase !== 'waiting' ? null : <TxLink hash={hash} />}
        </Row>
      )}
      {phase === 'waiting' && (
        <Row tone="wait">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-think rounded-full bg-gold-300"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </span>
          Waiting for the oracle{watchId !== null ? ` to answer question #${watchId}` : ''}
        </Row>
      )}
      {error && (
        <Row tone="error">
          <AlertCircle className="size-4" /> {error}
        </Row>
      )}
    </div>
  )
}
