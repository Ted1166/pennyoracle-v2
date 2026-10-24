import { env } from '@/env'

export interface FeedItem {
  id: number
  asker: string
  question: string
  answer: string | null
  answerHash: string | null
  fulfilled: boolean
  refunded: boolean
  askedAt: number
  fulfilledAt: number | null
}

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('Backend not configured')
  }
}

function toSeconds(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalize(raw: unknown): FeedItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  const id = Number(row.id)
  const askedAt = toSeconds(row.askedAt)
  if (!Number.isInteger(id) || id < 0 || askedAt === null) return null
  return {
    id,
    asker: typeof row.asker === 'string' ? row.asker : '',
    question: typeof row.question === 'string' ? row.question : '',
    answer: toText(row.answer),
    answerHash: toText(row.answerHash),
    fulfilled: row.fulfilled === true,
    refunded: row.refunded === true,
    askedAt,
    fulfilledAt: toSeconds(row.fulfilledAt),
  }
}

async function fetchList(path: string): Promise<FeedItem[]> {
  if (!env.backendUrl) throw new BackendNotConfiguredError()
  const response = await fetch(`${env.backendUrl}${path}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Backend responded with ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) throw new Error('Backend returned an unexpected payload')
  return body
    .map(normalize)
    .filter((item): item is FeedItem => item !== null)
    .sort((a, b) => b.id - a.id)
}

export function fetchFeed(): Promise<FeedItem[]> {
  return fetchList('/feed')
}

export function fetchHistory(address: string): Promise<FeedItem[]> {
  return fetchList(`/history/${address}`)
}
