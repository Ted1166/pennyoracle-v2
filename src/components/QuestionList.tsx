import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { Loader2 } from 'lucide-react'
import type { FeedItem } from '@/lib/api'
import { useChainQuestions, useNow, useRefundTimeout } from '@/hooks/useOracleData'
import { useRefund } from '@/hooks/useRefund'
import { QuestionCard } from './QuestionCard'

const VISIBLE = 50

interface Props {
  items: FeedItem[] | undefined
  loading: boolean
  error: string | null
  emptyTitle: string
  emptyHint: string
}

export function QuestionList({ items, loading, error, emptyTitle, emptyHint }: Props) {
  const { address } = useAccount()
  const now = useNow(5000)
  const timeout = useRefundTimeout()
  const { refund, refundingId, error: refundError } = useRefund()
  const visible = useMemo(() => (items ?? []).slice(0, VISIBLE), [items])
  const ids = useMemo(() => visible.map((item) => item.id), [visible])
  const chain = useChainQuestions(ids)

  if (error) {
    return (
      <div className="rounded-3xl bg-aubergine-800 p-8 text-center ring-1 ring-white/5">
        <p className="font-display text-xl text-cream">The answer feed is unreachable</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist">{error}</p>
      </div>
    )
  }

  if (loading && !items) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-aubergine-800 p-10 text-sm text-mist ring-1 ring-white/5">
        <Loader2 className="size-4 animate-spin" /> Loading questions
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-3xl bg-aubergine-800 p-10 text-center ring-1 ring-white/5">
        <p className="font-display text-xl text-cream">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mist">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visible.map((item) => (
        <QuestionCard
          key={item.id}
          item={item}
          chain={chain.get(item.id)}
          timeout={timeout.data !== undefined ? Number(timeout.data) : undefined}
          now={now}
          viewer={address}
          refunding={refundingId === item.id}
          refundBusy={refundingId !== null}
          refundError={refundError?.id === item.id ? refundError.message : null}
          onRefund={(id) => void refund(id)}
        />
      ))}
    </div>
  )
}
