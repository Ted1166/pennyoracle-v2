import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReadContract, useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import { env } from '@/env'
import { appChain } from '@/lib/chain'
import { pennyOracleAbi } from '@/lib/abi'
import { fetchFeed, fetchHistory } from '@/lib/api'

export interface ChainQuestion {
  asker: `0x${string}`
  question: string
  answerHash: `0x${string}`
  fulfilled: boolean
  refunded: boolean
  askedAt: number
  settledAt: number
}

const oracle = { address: env.contractAddress, abi: pennyOracleAbi, chainId: appChain.id } as const

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useFeed() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
    enabled: Boolean(env.backendUrl),
    refetchInterval: 6000,
    retry: 1,
  })
}

export function useHistory(address: string | undefined) {
  return useQuery({
    queryKey: ['history', address],
    queryFn: () => fetchHistory(address as string),
    enabled: Boolean(env.backendUrl && address),
    refetchInterval: 6000,
    retry: 1,
  })
}

export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: env.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: appChain.id,
    query: { enabled: Boolean(address), refetchInterval: 5000 },
  })
}

export function usePrice() {
  return useReadContract({
    ...oracle,
    functionName: 'PRICE',
    query: { staleTime: Infinity },
  })
}

export function useRefundTimeout() {
  return useReadContract({
    ...oracle,
    functionName: 'refundTimeout',
    query: { staleTime: Infinity },
  })
}

export function useChainQuestions(ids: readonly number[]): Map<number, ChainQuestion> {
  const { data } = useReadContracts({
    contracts: ids.map((id) => ({ ...oracle, functionName: 'getQuestion' as const, args: [BigInt(id)] as const })),
    query: { enabled: ids.length > 0, refetchInterval: 6000 },
  })
  return useMemo(() => {
    const map = new Map<number, ChainQuestion>()
    if (!data) return map
    ids.forEach((id, index) => {
      const entry = data[index]
      if (entry?.status !== 'success') return
      const value = entry.result
      map.set(id, {
        asker: value.asker,
        question: value.question,
        answerHash: value.answerHash,
        fulfilled: value.fulfilled,
        refunded: value.refunded,
        askedAt: Number(value.askedAt),
        settledAt: Number(value.settledAt),
      })
    })
    return map
  }, [data, ids])
}
