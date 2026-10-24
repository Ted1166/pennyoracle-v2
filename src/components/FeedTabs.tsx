import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { env } from '@/env'
import { BackendNotConfiguredError } from '@/lib/api'
import { useFeed, useHistory } from '@/hooks/useOracleData'
import { QuestionList } from './QuestionList'

type Tab = 'feed' | 'history'

function describe(error: unknown): string | null {
  if (!error) return null
  if (error instanceof BackendNotConfiguredError) {
    return 'Set VITE_BACKEND_URL to the oracle backend to load answers.'
  }
  return error instanceof Error ? error.message : 'Unable to load the feed.'
}

export function FeedTabs() {
  const [tab, setTab] = useState<Tab>('feed')
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const feed = useFeed()
  const history = useHistory(address)

  const missingBackend = !env.backendUrl
  const feedError = missingBackend ? describe(new BackendNotConfiguredError()) : describe(feed.error)
  const historyError = missingBackend ? describe(new BackendNotConfiguredError()) : describe(history.error)

  const tabs: { id: Tab; label: string; count: number | undefined }[] = [
    { id: 'feed', label: 'Public feed', count: feed.data?.length },
    { id: 'history', label: 'My questions', count: isConnected ? history.data?.length : undefined },
  ]

  return (
    <section className="mx-auto mt-20 w-full max-w-2xl">
      <div role="tablist" aria-label="Questions" className="mb-6 flex gap-6 border-b border-white/10">
        {tabs.map((entry) => {
          const active = tab === entry.id
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={`relative -mb-px min-h-11 pb-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper-300 ${
                active ? 'text-cream' : 'text-mist hover:text-cream'
              }`}
            >
              {entry.label}
              {entry.count !== undefined && (
                <span className="ml-2 font-mono text-xs tabular-nums text-gold-400">{entry.count}</span>
              )}
              {active && <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-copper-600 to-copper-400" />}
            </button>
          )
        })}
      </div>

      {tab === 'feed' && (
        <QuestionList
          items={feed.data}
          loading={feed.isLoading}
          error={feedError}
          emptyTitle="No questions yet"
          emptyHint="Be the first to put a penny in the slot."
        />
      )}

      {tab === 'history' &&
        (isConnected ? (
          <QuestionList
            items={history.data}
            loading={history.isLoading}
            error={historyError}
            emptyTitle="You have not asked anything yet"
            emptyHint="Your questions, answers and refunds will collect here."
          />
        ) : (
          <div className="rounded-3xl bg-aubergine-800 p-10 text-center ring-1 ring-white/5">
            <p className="font-display text-xl text-cream">Connect to see your questions</p>
            <button
              type="button"
              onClick={() => openConnectModal?.()}
              className="mt-4 inline-flex h-11 items-center rounded-full border border-copper-500/60 px-5 text-sm text-copper-300 transition hover:bg-copper-600/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-300"
            >
              Connect wallet
            </button>
          </div>
        ))}
    </section>
  )
}
