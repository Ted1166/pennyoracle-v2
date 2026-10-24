import { useEffect, useRef, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { CircleDollarSign, Loader2 } from 'lucide-react'
import { useAsk } from '@/hooks/useAsk'
import { usePrice, useRefundTimeout, useUsdcBalance } from '@/hooks/useOracleData'
import { MAX_QUESTION_BYTES } from '@/lib/abi'
import { byteLength, clampToBytes } from '@/lib/bytes'
import { appChain } from '@/lib/chain'
import { formatDuration, formatUsdc } from '@/lib/format'
import { StatusLine } from './StatusLine'

export function CoinSlot() {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { phase, error, success, hash, watchId, submit, wrongChain } = useAsk()
  const balance = useUsdcBalance(address)
  const price = usePrice()
  const timeout = useRefundTimeout()
  const [value, setValue] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)

  const bytes = byteLength(value)
  const busy = phase === 'switching' || phase === 'approving' || phase === 'asking'
  const priceText = price.data !== undefined ? formatUsdc(price.data) : '…'
  const insufficient =
    balance.data !== undefined && price.data !== undefined && balance.data < price.data
  const ready = value.trim().length > 0 && price.data !== undefined && !insufficient && !busy

  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  const counterTone =
    bytes >= MAX_QUESTION_BYTES ? 'text-copper-300' : bytes >= 340 ? 'text-gold-300' : 'text-mist'

  async function onSubmit() {
    if (!ready) return
    const sent = await submit(value.trim())
    if (sent) setValue('')
  }

  let label = `Insert ${priceText} USDC`
  if (!isConnected) label = 'Connect wallet'
  else if (wrongChain) label = `Switch to ${appChain.name}`
  else if (phase === 'switching') label = 'Switching'
  else if (phase === 'approving') label = 'Approving'
  else if (phase === 'asking') label = 'Asking'
  else if (insufficient) label = 'Not enough USDC'

  function onAction() {
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (wrongChain) {
      switchChain({ chainId: appChain.id })
      return
    }
    void onSubmit()
  }

  const actionDisabled = isConnected && !wrongChain && !ready
  const spinning = busy || switching

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="relative mx-auto mb-[-7px] h-3.5 w-44 rounded-full bg-aubergine-950 shadow-[0_0_24px_rgba(227,162,109,0.28)] ring-1 ring-copper-600/50">
        <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 animate-glow bg-gradient-to-r from-transparent via-copper-400 to-transparent" />
      </div>
      <div className="rounded-[2rem] bg-gradient-to-r from-copper-600 via-copper-400 to-copper-600 p-px shadow-coin">
        <div className="flex flex-col gap-2 rounded-[calc(2rem-1px)] bg-aubergine-800 p-2 sm:flex-row sm:items-end">
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            ref={field}
            rows={1}
            value={value}
            disabled={busy}
            onChange={(event) => setValue(clampToBytes(event.target.value, MAX_QUESTION_BYTES))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (isConnected && !wrongChain) void onSubmit()
              }
            }}
            placeholder="Ask the Oracle anything…"
            className="min-h-12 flex-1 resize-none bg-transparent px-4 py-3 font-display text-lg leading-snug text-cream outline-none placeholder:text-mist/60 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-copper-600 to-copper-400 px-6 text-sm font-semibold text-aubergine-950 shadow-coin transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {spinning ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />}
            {label}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 text-xs">
        <span className={`font-mono tabular-nums ${counterTone}`} aria-live="off">
          {bytes} / {MAX_QUESTION_BYTES} bytes
        </span>
        <span className="tabular-nums text-mist">
          {isConnected
            ? `Balance ${balance.data !== undefined ? formatUsdc(balance.data) : '…'} USDC`
            : `${priceText} USDC per question`}
          {timeout.data !== undefined ? ` · refundable after ${formatDuration(Number(timeout.data))}` : ''}
        </span>
      </div>
      <StatusLine phase={phase} hash={hash} error={error} success={success} watchId={watchId} />
    </section>
  )
}
