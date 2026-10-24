import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useConfig, useReadContract, useSwitchChain } from 'wagmi'
import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { erc20Abi, parseEventLogs } from 'viem'
import { env } from '@/env'
import { appChain } from '@/lib/chain'
import { pennyOracleAbi } from '@/lib/abi'
import { parseOnchainError } from '@/lib/errors'

export type AskPhase = 'idle' | 'switching' | 'approving' | 'asking' | 'waiting'

export function useAsk() {
  const config = useConfig()
  const queryClient = useQueryClient()
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const [phase, setPhase] = useState<AskPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)

  const watched = useReadContract({
    address: env.contractAddress,
    abi: pennyOracleAbi,
    functionName: 'getQuestion',
    args: watchId === null ? undefined : [BigInt(watchId)],
    chainId: appChain.id,
    query: { enabled: watchId !== null, refetchInterval: 6000 },
  })

  const watchedFulfilled = watched.data?.fulfilled === true
  const watchedRefunded = watched.data?.refunded === true

  if (watchId !== null && (watchedFulfilled || watchedRefunded)) {
    if (watchedFulfilled) setSuccess(`The Oracle answered question #${watchId}`)
    setWatchId(null)
    setPhase('idle')
  }

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 5000)
    return () => clearTimeout(timer)
  }, [success])

  const submit = useCallback(
    async (question: string): Promise<boolean> => {
      if (!address) return false
      setError(null)
      setSuccess(null)
      setHash(null)
      try {
        if (chainId !== appChain.id) {
          setPhase('switching')
          await switchChainAsync({ chainId: appChain.id })
        }
        const price = await readContract(config, {
          address: env.contractAddress,
          abi: pennyOracleAbi,
          functionName: 'PRICE',
          chainId: appChain.id,
        })
        const allowance = await readContract(config, {
          address: env.usdcAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, env.contractAddress],
          chainId: appChain.id,
        })
        if (allowance < price) {
          setPhase('approving')
          const approveHash = await writeContract(config, {
            address: env.usdcAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [env.contractAddress, price],
            chainId: appChain.id,
          })
          setHash(approveHash)
          const approval = await waitForTransactionReceipt(config, { hash: approveHash, chainId: appChain.id })
          if (approval.status !== 'success') throw new Error('Approval reverted')
        }
        setPhase('asking')
        setHash(null)
        const askHash = await writeContract(config, {
          address: env.contractAddress,
          abi: pennyOracleAbi,
          functionName: 'ask',
          args: [question],
          chainId: appChain.id,
        })
        setHash(askHash)
        const receipt = await waitForTransactionReceipt(config, { hash: askHash, chainId: appChain.id })
        if (receipt.status !== 'success') throw new Error('Ask reverted')
        const events = parseEventLogs({ abi: pennyOracleAbi, logs: receipt.logs, eventName: 'Asked' })
        const mine = events.find((event) => event.address.toLowerCase() === env.contractAddress.toLowerCase())
        void queryClient.invalidateQueries()
        if (mine) {
          const id = Number(mine.args.id)
          setWatchId(id)
          setPhase('waiting')
          setSuccess(`Question #${id} is in escrow`)
        } else {
          setPhase('idle')
          setSuccess('Question submitted')
        }
        return true
      } catch (caught) {
        const parsed = parseOnchainError(caught)
        if (!parsed.silent) setError(parsed.message)
        setPhase('idle')
        return false
      }
    },
    [address, chainId, config, queryClient, switchChainAsync],
  )

  return { phase, error, success, hash, watchId, submit, wrongChain: Boolean(address) && chainId !== appChain.id }
}
