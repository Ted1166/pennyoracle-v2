import { useMemo } from 'react'
import { keccak256, stringToBytes } from 'viem'
import { AlertTriangle, Loader2, ShieldCheck, Undo2 } from 'lucide-react'
import type { FeedItem } from '@/lib/api'
import type { ChainQuestion } from '@/hooks/useOracleData'
import { formatDuration, shortAddress, shortHash, timeAgo } from '@/lib/format'

interface Props {
  item: FeedItem
  chain: ChainQuestion | undefined
  timeout: number | undefined
  now: number
  viewer: string | undefined
  refunding: boolean
  refundBusy: boolean
  refundError: string | null
  onRefund: (id: number) => void
}

type Verification = 'checking' | 'verified' | 'mismatch' | 'missing'

function Thinking() {
  return (
    <div className="flex items-center gap-3 font-display text-lg italic text-gold-300">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-think rounded-full bg-gold-300"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
      The Oracle is thinking
    </div>
  )
}

export function QuestionCard({
  item,
  chain,
  timeout,
  now,
  viewer,
  refunding,
  refundBusy,
  refundError,
  onRefund,
}: Props) {
  const refunded = chain ? chain.refunded : item.refunded
  const fulfilled = chain ? chain.fulfilled : item.fulfilled
  const state = refunded ? 'refunded' : fulfilled ? 'answered' : 'pending'
  const asker = chain?.asker ?? item.asker
  const question = chain?.question || item.question
  const askedAt = chain?.askedAt ?? item.askedAt
  const isOwner = Boolean(viewer) && asker.toLowerCase() === viewer?.toLowerCase()

  const verification = useMemo<Verification>(() => {
    if (state !== 'answered') return 'missing'
    if (!item.answer) return 'missing'
    if (!chain) return 'checking'
    return keccak256(stringToBytes(item.answer)).toLowerCase() === chain.answerHash.toLowerCase()
      ? 'verified'
      : 'mismatch'
  }, [state, item.answer, chain])

  const refundableAt = timeout !== undefined ? askedAt + timeout : undefined
  const refundOpen = state === 'pending' && chain !== undefined && refundableAt !== undefined && now >= refundableAt
  const refundWaiting = state === 'pending' && isOwner && refundableAt !== undefined && now < refundableAt

  return (
    <article className="animate-rise rounded-3xl bg-aubergine-800 p-5 shadow-card ring-1 ring-white/5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 text-xs text-mist">
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-gold-300">#{item.id}</span>
          <span className="font-mono">{shortAddress(asker)}</span>
          {isOwner && <span className="rounded-full bg-copper-600/20 px-2 py-0.5 text-[11px] text-copper-300">You</span>}
        </div>
        <time className="tabular-nums" dateTime={new Date(askedAt * 1000).toISOString()}>
          {timeAgo(askedAt, now)}
        </time>
      </header>

      <p className="mt-3 text-pretty font-display text-xl leading-snug text-cream sm:text-2xl">{question}</p>

      <div className="mt-4 rounded-2xl bg-aubergine-900/70 p-4">
        {state === 'pending' && <Thinking />}

        {state === 'refunded' && (
          <div className="flex items-center gap-2 text-sm text-gold-300">
            <Undo2 className="size-4" />
            Refunded. 0.01 USDC went back to the asker.
          </div>
        )}

        {state === 'answered' && (
          <div className="space-y-3">
            {item.answer ? (
              <p className="border-l-2 border-gold-400/60 pl-3 text-pretty text-[15px] leading-relaxed text-cream/95">
                {item.answer}
              </p>
            ) : (
              <p className="text-sm text-mist">The Oracle posted an answer hash. The answer text is not available yet.</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-mist" title={chain?.answerHash}>
                {chain ? shortHash(chain.answerHash) : 'reading hash…'}
              </span>
              {verification === 'verified' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-500/15 px-2.5 py-1 text-xs font-medium text-verify-300 ring-1 ring-verify-400/30">
                  <ShieldCheck className="size-3.5" /> Verified on Arc
                </span>
              )}
              {verification === 'checking' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-mist">
                  <Loader2 className="size-3.5 animate-spin" /> Checking hash
                </span>
              )}
              {verification === 'mismatch' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0A3A3]/10 px-2.5 py-1 text-xs text-[#F0A3A3] ring-1 ring-[#F0A3A3]/30">
                  <AlertTriangle className="size-3.5" /> Hash does not match
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {(refundOpen && isOwner) || refundWaiting || refundError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {refundOpen && isOwner ? (
            <button
              type="button"
              onClick={() => onRefund(item.id)}
              disabled={refundBusy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-copper-600 to-copper-400 px-5 text-sm font-semibold text-aubergine-950 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {refunding ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              {refunding ? 'Refunding' : 'Refund 0.01 USDC'}
            </button>
          ) : refundWaiting && refundableAt !== undefined ? (
            <span className="text-xs text-mist">Refund opens in {formatDuration(refundableAt - now)}</span>
          ) : (
            <span />
          )}
          {refundError && <span className="text-xs text-[#F0A3A3]">{refundError}</span>}
        </div>
      ) : null}
    </article>
  )
}
