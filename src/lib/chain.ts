import { defineChain } from 'viem'
import { env } from '@/env'

interface KnownChain {
  name: string
  explorerBase: string
  isTestnet: boolean
}

const KNOWN_CHAINS: Record<number, KnownChain> = {
  5042002: { name: 'Arc Testnet', explorerBase: 'https://explorer.testnet.arc.io', isTestnet: true },
  5042: { name: 'Arc', explorerBase: 'https://explorer.arc.io', isTestnet: false },
}

const known = KNOWN_CHAINS[env.chainId]

export const appChain = defineChain({
  id: env.chainId,
  name: known?.name ?? `Chain ${env.chainId}`,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockExplorers: known
    ? { default: { name: 'Explorer', url: known.explorerBase } }
    : undefined,
  testnet: known?.isTestnet,
})

export function txUrl(hash: string): string | undefined {
  const base = appChain.blockExplorers?.default.url
  return base ? `${base}/tx/${hash}` : undefined
}
