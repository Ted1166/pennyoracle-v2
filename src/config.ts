import { http, createConfig } from 'wagmi'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { env } from '@/env'
import { appChain } from '@/lib/chain'
import { registerChain } from './tracing'

registerChain(appChain.id, env.rpcUrl)

const wallets = env.walletConnectProjectId
  ? [injectedWallet, metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet]
  : [injectedWallet, coinbaseWallet]

const connectors = connectorsForWallets(
  [{ groupName: 'Wallets', wallets }],
  { appName: 'PennyOracle', projectId: env.walletConnectProjectId },
)

export const config = createConfig({
  chains: [appChain],
  connectors,
  transports: { [appChain.id]: http(env.rpcUrl) },
})
