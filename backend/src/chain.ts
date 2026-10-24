import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Config } from './config.ts'

export function createClients(config: Config) {
  const chain = defineChain({
    id: config.chainId,
    name: `chain-${config.chainId}`,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  })
  const account = privateKeyToAccount(config.oraclePrivateKey)
  const publicClient = createPublicClient({
    chain,
    pollingInterval: 1_000,
    transport: http(config.rpcUrl, { timeout: 20_000, retryCount: 3, retryDelay: 500 }),
  })
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl, { timeout: 30_000, retryCount: 2, retryDelay: 500 }),
  })
  return { chain, account, publicClient, walletClient }
}

export type Clients = ReturnType<typeof createClients>
