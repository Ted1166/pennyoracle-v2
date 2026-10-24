import assert from 'node:assert/strict'
import type { ChildProcess } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import { type Hex, keccak256, stringToBytes } from 'viem'
import { createClients } from '../src/chain.ts'
import type { Config } from '../src/config.ts'
import { OracleService } from '../src/oracle.ts'
import { Store } from '../src/store.ts'
import {
  ANVIL_URL,
  CHAIN_ID,
  type Deployment,
  askQuestion,
  deploy,
  funded,
  oracleArtifact,
  pastTimeout,
  publicClient,
  send,
  startAnvil,
  usdcArtifact,
  waitFor,
} from './helpers.ts'

const available = Boolean(oracleArtifact && usdcArtifact)

interface ChainState {
  fulfilled: boolean
  refunded: boolean
  answerHash: Hex
}

async function chainState(deployment: Deployment, id: number): Promise<ChainState> {
  if (!oracleArtifact) throw new Error('missing artifact')
  return (await publicClient.readContract({
    address: deployment.oracle,
    abi: oracleArtifact.abi,
    functionName: 'getQuestion',
    args: [BigInt(id)],
  })) as ChainState
}

function build(deployment: Deployment, answer: (question: string) => Promise<string>) {
  const config: Config = {
    rpcUrl: ANVIL_URL,
    chainId: CHAIN_ID,
    contractAddress: deployment.oracle,
    oraclePrivateKey: deployment.oracleKey,
    anthropicApiKey: 'unused',
    anthropicModel: 'unused',
    port: 0,
    dbPath: ':memory:',
  }
  const clients = createClients(config)
  const store = new Store(':memory:')
  const service = new OracleService(config, clients, store, answer, {
    pollIntervalMs: 100,
    sweepIntervalMs: 60_000,
  })
  return { service, store }
}

describe('oracle service against a local fork', { skip: !available && 'contract artifacts missing' }, () => {
  let anvil: ChildProcess

  before(async () => {
    anvil = await startAnvil()
  })

  after(() => {
    anvil.kill()
  })

  it('answers questions that were pending before startup and hashes the UTF-8 bytes', async () => {
    const d = await deploy()
    const asker = await funded()
    const first = await askQuestion(d, asker, 'Will it rain?')
    const second = await askQuestion(d, asker, 'Shall I travel?')
    const seen: string[] = []
    const { service, store } = build(d, (q) => {
      seen.push(q)
      return Promise.resolve(`Fortune for "${q}": café ☕ awaits.`)
    })

    await service.sweep()

    for (const id of [first, second]) {
      const state = await chainState(d, id)
      const record = store.get(id)
      assert.equal(state.fulfilled, true)
      assert.ok(record?.answer)
      assert.equal(state.answerHash, keccak256(stringToBytes(record.answer)))
      assert.equal(record.answerHash, state.answerHash)
      assert.equal(record.fulfilled, true)
      assert.ok(record.fulfilledAt && record.fulfilledAt >= record.askedAt)
    }
    assert.deepEqual(seen.sort(), ['Shall I travel?', 'Will it rain?'])
    assert.equal(store.get(first)?.answer, 'Fortune for "Will it rain?": café ☕ awaits.')
  })

  it('skips fulfilled and refunded questions and only calls the AI for the pending one', async () => {
    const d = await deploy()
    const asker = await funded()
    const done = await askQuestion(d, asker, 'Already answered?')
    const refunded = await askQuestion(d, asker, 'Too slow?')
    const pending = await askQuestion(d, asker, 'Still waiting?')
    if (!oracleArtifact) throw new Error('missing artifact')
    await send(d.oracleAccount, d.oracle, oracleArtifact.abi, 'fulfill', [BigInt(done), keccak256(stringToBytes('x'))])
    await pastTimeout()
    await send(asker, d.oracle, oracleArtifact.abi, 'refund', [BigInt(refunded)])
    const seen: string[] = []
    const { service, store } = build(d, (q) => {
      seen.push(q)
      return Promise.resolve('The candle approves.')
    })

    await service.sweep()

    assert.deepEqual(seen, ['Still waiting?'])
    assert.equal(store.get(done)?.fulfilled, true)
    assert.equal(store.get(done)?.answer, null)
    assert.equal(store.get(refunded)?.refunded, true)
    assert.equal(store.get(pending)?.fulfilled, true)
    assert.equal((await chainState(d, refunded)).fulfilled, false)
  })

  it('answers questions asked while the service is running', async () => {
    const d = await deploy()
    const asker = await funded()
    const { service, store } = build(d, () => Promise.resolve('Live fortune.'))
    await service.start()
    try {
      const id = await askQuestion(d, asker, 'Are you listening?')
      await waitFor(() => store.get(id)?.fulfilled === true)
      assert.equal(store.get(id)?.answer, 'Live fortune.')
      assert.equal((await chainState(d, id)).fulfilled, true)
    } finally {
      await service.stop()
    }
  })

  it('marks refunds from events and never fulfils a refunded question', async () => {
    const d = await deploy()
    const asker = await funded()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let calls = 0
    const { service, store } = build(d, async () => {
      calls += 1
      await gate
      return 'Too late.'
    })
    await service.start()
    try {
      const id = await askQuestion(d, asker, 'Anyone there?')
      await waitFor(() => calls === 1)
      await pastTimeout()
      if (!oracleArtifact) throw new Error('missing artifact')
      await send(asker, d.oracle, oracleArtifact.abi, 'refund', [BigInt(id)])
      await waitFor(() => store.get(id)?.refunded === true)
      release()
      await waitFor(() => service.inFlightCount === 0)
      const state = await chainState(d, id)
      assert.equal(state.refunded, true)
      assert.equal(state.fulfilled, false)
      assert.equal(store.get(id)?.fulfilled, false)
      assert.equal(store.get(id)?.answer, null)
    } finally {
      release()
      await service.stop()
    }
  })

  it('never processes the same id twice concurrently', async () => {
    const d = await deploy()
    const asker = await funded()
    const id = await askQuestion(d, asker, 'Twice?')
    let calls = 0
    const { service } = build(d, async () => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 300))
      return 'Once is enough.'
    })

    const results = await Promise.all([service.processQuestion(id), service.processQuestion(id)])

    assert.deepEqual([...results].sort(), ['busy', 'fulfilled'])
    assert.equal(calls, 1)
  })

  it('recovers after an AI failure on the next attempt', async () => {
    const d = await deploy()
    const asker = await funded()
    const id = await askQuestion(d, asker, 'Try again?')
    let calls = 0
    const { service, store } = build(d, () => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('upstream down')) : Promise.resolve('Second time lucky.')
    })

    assert.equal(await service.processQuestion(id), 'failed')
    assert.equal((await chainState(d, id)).fulfilled, false)
    assert.equal(await service.processQuestion(id), 'fulfilled')
    assert.equal(store.get(id)?.answer, 'Second time lucky.')
  })

  it('reuses a stored draft instead of asking the AI again', async () => {
    const d = await deploy()
    const asker = await funded()
    const id = await askQuestion(d, asker, 'Crash recovery?')
    let calls = 0
    const { service, store } = build(d, () => {
      calls += 1
      return Promise.resolve('Fresh answer.')
    })
    const chain = await service.sync(id)
    assert.equal(chain.fulfilled, false)
    store.saveDraft(id, 'Saved draft.', keccak256(stringToBytes('Saved draft.')))

    assert.equal(await service.processQuestion(id), 'fulfilled')

    assert.equal(calls, 0)
    assert.equal(store.get(id)?.answer, 'Saved draft.')
    assert.equal((await chainState(d, id)).answerHash, keccak256(stringToBytes('Saved draft.')))
  })

  it('keeps the answer text when the fulfil landed but the database write was lost', async () => {
    const d = await deploy()
    const asker = await funded()
    const id = await askQuestion(d, asker, 'Lost write?')
    const { service, store } = build(d, () => Promise.reject(new Error('must not be called')))
    await service.sync(id)
    store.saveDraft(id, 'Recorded before the crash.', keccak256(stringToBytes('Recorded before the crash.')))
    if (!oracleArtifact) throw new Error('missing artifact')
    await send(d.oracleAccount, d.oracle, oracleArtifact.abi, 'fulfill', [
      BigInt(id),
      keccak256(stringToBytes('Recorded before the crash.')),
    ])

    await service.sweep()

    assert.equal(store.get(id)?.fulfilled, true)
    assert.equal(store.get(id)?.answer, 'Recorded before the crash.')
  })

  it('answers many questions at once without nonce collisions', async () => {
    const d = await deploy()
    const asker = await funded()
    const ids: number[] = []
    for (let index = 0; index < 6; index += 1) ids.push(await askQuestion(d, asker, `Batch ${index}?`))
    const { service, store } = build(d, (q) => Promise.resolve(`Answer to ${q}`))

    await service.sweep()

    for (const id of ids) {
      assert.equal(store.get(id)?.fulfilled, true)
      assert.equal((await chainState(d, id)).fulfilled, true)
    }
  })
})
