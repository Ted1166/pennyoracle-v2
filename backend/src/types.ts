import type { Address, Hex } from 'viem'

export interface ChainQuestion {
  asker: Address
  question: string
  answerHash: Hex
  fulfilled: boolean
  refunded: boolean
  askedAt: number
  settledAt: number
}

export interface QuestionRecord {
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
