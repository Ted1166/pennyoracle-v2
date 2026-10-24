import { getAddress, isAddress } from 'viem'
import type { Address, Hex } from 'viem'

export interface Config {
  rpcUrl: string
  chainId: number
  contractAddress: Address
  oraclePrivateKey: Hex
  anthropicApiKey: string
  anthropicModel: string
  port: number
  dbPath: string
}

export class ConfigError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = []

  const required = (name: string): string => {
    const value = env[name]?.trim() ?? ''
    if (!value) problems.push(`${name} is required`)
    return value
  }

  const rpcUrl = required('ARC_RPC_URL')
  if (rpcUrl) {
    try {
      const parsed = new URL(rpcUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        problems.push('ARC_RPC_URL must be an http or https URL')
      }
    } catch {
      problems.push('ARC_RPC_URL must be a valid URL')
    }
  }

  const chainIdText = required('CHAIN_ID')
  const chainId = Number(chainIdText)
  if (chainIdText && (!Number.isInteger(chainId) || chainId <= 0)) {
    problems.push('CHAIN_ID must be a positive integer')
  }

  const contractText = required('CONTRACT_ADDRESS')
  if (contractText && !isAddress(contractText, { strict: false })) {
    problems.push('CONTRACT_ADDRESS must be a valid address')
  }

  const keyText = required('ORACLE_PRIVATE_KEY')
  const normalizedKey = keyText.startsWith('0x') ? keyText : `0x${keyText}`
  if (keyText && !/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    problems.push('ORACLE_PRIVATE_KEY must be a 32-byte hex private key')
  }

  const anthropicApiKey = required('ANTHROPIC_API_KEY')
  const anthropicModel = required('ANTHROPIC_MODEL')

  const portText = env.PORT?.trim() || '3001'
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('PORT must be an integer between 1 and 65535')
  }

  const dbPath = env.DB_PATH?.trim() || './data/oracle.db'

  if (problems.length > 0) throw new ConfigError(problems)

  return {
    rpcUrl,
    chainId,
    contractAddress: getAddress(contractText),
    oraclePrivateKey: normalizedKey as Hex,
    anthropicApiKey,
    anthropicModel,
    port,
    dbPath,
  }
}
