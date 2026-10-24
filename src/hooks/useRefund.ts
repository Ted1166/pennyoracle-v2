import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useConfig, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { env } from '@/env'
import { appChain } from '@/lib/chain'
import { pennyOracleAbi } from '@/lib/abi'
import { parseOnchainError } from '@/lib/errors'

export function useRefund() {
  const config = useConfig()
  const queryClient = useQueryClient()
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const [refundingId, setRefundingId] = useState<number | null>(null)
  const [error, setError] = useState<{ id: number; message: string } | null>(null)

  const refund = useCallback(
    async (id: number) => {
      setError(null)
      setRefundingId(id)
      try {
        if (chainId !== appChain.id) await switchChainAsync({ chainId: appChain.id })
        const hash = await writeContract(config, {
          address: env.contractAddress,
          abi: pennyOracleAbi,
          functionName: 'refund',
          args: [BigInt(id)],
          chainId: appChain.id,
        })
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: appChain.id })
        if (receipt.status !== 'success') throw new Error('Refund reverted')
        await queryClient.invalidateQueries()
      } catch (caught) {
        const parsed = parseOnchainError(caught)
        if (!parsed.silent) setError({ id, message: parsed.message })
      } finally {
        setRefundingId(null)
      }
    },
    [chainId, config, queryClient, switchChainAsync],
  )

  return { refund, refundingId, error }
}
