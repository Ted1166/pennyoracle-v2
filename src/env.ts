import { isAddress } from 'viem'

const source = import.meta.env

const issues: string[] = []

function readChainId(): number {
  const value = Number(source.VITE_CHAIN_ID)
  if (!source.VITE_CHAIN_ID || !Number.isInteger(value) || value <= 0) {
    issues.push('VITE_CHAIN_ID must be a positive integer')
    return 0
  }
  return value
}

function readUrl(name: 'VITE_RPC_URL'): string {
  const value = source[name]?.trim() ?? ''
  try {
    new URL(value)
    return value
  } catch {
    issues.push(`${name} must be a valid URL`)
    return ''
  }
}

function readAddress(name: 'VITE_CONTRACT_ADDRESS' | 'VITE_USDC_ADDRESS'): `0x${string}` {
  const value = source[name]?.trim() ?? ''
  if (!isAddress(value, { strict: false })) {
    issues.push(`${name} must be a valid address`)
    return '0x0000000000000000000000000000000000000000'
  }
  return value
}

export const env = {
  chainId: readChainId(),
  rpcUrl: readUrl('VITE_RPC_URL'),
  contractAddress: readAddress('VITE_CONTRACT_ADDRESS'),
  usdcAddress: readAddress('VITE_USDC_ADDRESS'),
  backendUrl: (source.VITE_BACKEND_URL ?? '').trim().replace(/\/+$/, ''),
  walletConnectProjectId: (source.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim(),
}

export const envIssues: readonly string[] = issues
