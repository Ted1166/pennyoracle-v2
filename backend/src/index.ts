import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { getAddress } from 'viem'
import { pennyOracleAbi } from './abi.ts'
import { createAnswerer } from './ai.ts'
import { createClients } from './chain.ts'
import { ConfigError, loadConfig } from './config.ts'
import { log, registerSecrets } from './log.ts'
import { OracleService } from './oracle.ts'
import { createApp } from './server.ts'
import { Store } from './store.ts'

loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  registerSecrets([config.oraclePrivateKey, config.oraclePrivateKey.slice(2), config.anthropicApiKey, config.rpcUrl])

  const clients = createClients(config)

  const remoteChainId = await clients.publicClient.getChainId()
  if (remoteChainId !== config.chainId) {
    throw new Error(`RPC reports chain ${remoteChainId} but CHAIN_ID is ${config.chainId}`)
  }

  const onchainOracle = await clients.publicClient.readContract({
    address: config.contractAddress,
    abi: pennyOracleAbi,
    functionName: 'oracle',
  })
  if (getAddress(onchainOracle) !== getAddress(clients.account.address)) {
    throw new Error(
      `The oracle wallet ${clients.account.address} is not the contract oracle (${onchainOracle}). Call setOracle first.`,
    )
  }

  const store = new Store(config.dbPath)
  const answerer = createAnswerer({ apiKey: config.anthropicApiKey, model: config.anthropicModel })
  const service = new OracleService(config, clients, store, answerer)
  const app = createApp(store, {
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    oracleAddress: clients.account.address,
    cursor: () => service.cursor,
    inFlight: () => service.inFlightCount,
  })

  const server = app.listen(config.port, () => {
    log.info(`Penny Oracle backend listening on port ${config.port}`)
    log.info(`Oracle wallet ${clients.account.address} serving contract ${config.contractAddress}`)
  })

  await service.start()

  let closing = false
  const shutdown = (signal: string): void => {
    if (closing) return
    closing = true
    log.info(`${signal} received, shutting down`)
    const force = setTimeout(() => process.exit(1), 10_000)
    force.unref()
    server.close()
    void service.stop().finally(() => {
      store.close()
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(error.message)
  } else {
    log.error('Fatal error', error)
  }
  process.exit(1)
})
