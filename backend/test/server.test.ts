import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import type { Server } from 'node:http'
import { createApp } from '../src/server.ts'
import { Store } from '../src/store.ts'
import type { ChainQuestion } from '../src/types.ts'

const ALICE = '0x00000000000000000000000000000000000A11CE'
const BOB = '0x0000000000000000000000000000000000000B0B'
const HASH = `0x${'ab'.repeat(32)}` as const
const ZERO = `0x${'00'.repeat(32)}` as const

function chain(asker: string, overrides: Partial<ChainQuestion> = {}): ChainQuestion {
  return {
    asker: asker as ChainQuestion['asker'],
    question: 'q',
    answerHash: ZERO,
    fulfilled: false,
    refunded: false,
    askedAt: 1000,
    settledAt: 0,
    ...overrides,
  }
}

describe('http api', () => {
  const store = new Store(':memory:')
  let server: Server
  let base = ''

  before(async () => {
    store.reconcile(0, chain(ALICE, { question: 'first', askedAt: 1000 }))
    store.saveDraft(0, 'Answer zero.', HASH)
    store.reconcile(0, chain(ALICE, { question: 'first', fulfilled: true, answerHash: HASH, settledAt: 1010 }))
    store.reconcile(1, chain(BOB, { question: 'second', askedAt: 1100 }))
    store.reconcile(2, chain(ALICE, { question: 'third', askedAt: 1200, refunded: true, settledAt: 1500 }))
    store.reconcile(3, chain(ALICE, { question: 'fourth', askedAt: 1300 }))
    store.saveDraft(3, 'Draft only.', HASH)
    store.reconcile(4, chain(BOB, { question: 'fifth', askedAt: 1400 }))
    store.saveDraft(4, 'Answer four.', HASH)
    store.reconcile(4, chain(BOB, { question: 'fifth', fulfilled: true, answerHash: HASH, settledAt: 1410 }))

    const app = createApp(store, {
      chainId: 5042002,
      contractAddress: '0xc0',
      oracleAddress: '0x0a',
      cursor: () => 42n,
      inFlight: () => 0,
    })
    server = app.listen(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(() => {
    server.close()
    store.close()
  })

  it('reports health', async () => {
    const response = await fetch(`${base}/health`)
    const body = (await response.json()) as Record<string, unknown>
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.lastScannedBlock, '42')
    assert.equal(body.pending, 2)
  })

  it('enables cors', async () => {
    const response = await fetch(`${base}/health`, { headers: { origin: 'https://example.test' } })
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
  })

  it('serves fulfilled questions newest first with the full record shape', async () => {
    const response = await fetch(`${base}/feed`)
    const body = (await response.json()) as Array<Record<string, unknown>>
    assert.deepEqual(
      body.map((entry) => entry.id),
      [4, 0],
    )
    assert.deepEqual(body[1], {
      id: 0,
      asker: ALICE,
      question: 'first',
      answer: 'Answer zero.',
      answerHash: HASH,
      fulfilled: true,
      refunded: false,
      askedAt: 1000,
      fulfilledAt: 1010,
    })
  })

  it('paginates the feed and validates limit and offset', async () => {
    const page = (await (await fetch(`${base}/feed?limit=1&offset=1`)).json()) as Array<{ id: number }>
    assert.deepEqual(
      page.map((entry) => entry.id),
      [0],
    )
    assert.equal((await fetch(`${base}/feed?limit=0`)).status, 400)
    assert.equal((await fetch(`${base}/feed?limit=abc`)).status, 400)
    assert.equal((await fetch(`${base}/feed?offset=-1`)).status, 400)
  })

  it('returns every question for an asker including pending and refunded, case-insensitively', async () => {
    const response = await fetch(`${base}/history/${ALICE.toLowerCase()}`)
    const body = (await response.json()) as Array<{
      id: number
      fulfilled: boolean
      refunded: boolean
      answer: string | null
      answerHash: string | null
      fulfilledAt: number | null
    }>
    assert.deepEqual(
      body.map((entry) => entry.id),
      [3, 2, 0],
    )
    const pending = body[0]
    assert.ok(pending)
    assert.equal(pending.fulfilled, false)
    assert.equal(pending.answer, null)
    assert.equal(pending.answerHash, null)
    assert.equal(pending.fulfilledAt, null)
    assert.equal(body[1]?.refunded, true)
    assert.equal(body[2]?.fulfilled, true)
  })

  it('rejects an invalid history address', async () => {
    assert.equal((await fetch(`${base}/history/nope`)).status, 400)
  })

  it('serves one question and handles unknown or malformed ids', async () => {
    const found = await fetch(`${base}/question/1`)
    assert.equal(found.status, 200)
    assert.equal(((await found.json()) as { question: string }).question, 'second')
    assert.equal((await fetch(`${base}/question/99`)).status, 404)
    assert.equal((await fetch(`${base}/question/x`)).status, 400)
  })

  it('returns json for unknown routes', async () => {
    const response = await fetch(`${base}/nothing`)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'not found' })
  })
})

describe('store reconciliation', () => {
  it('drops a draft whose hash does not match the onchain hash', () => {
    const store = new Store(':memory:')
    store.reconcile(0, chain(ALICE))
    store.saveDraft(0, 'Stale draft.', HASH)
    store.reconcile(0, chain(ALICE, { fulfilled: true, answerHash: `0x${'cd'.repeat(32)}`, settledAt: 5 }))
    const record = store.get(0)
    assert.equal(record?.fulfilled, true)
    assert.equal(record?.answer, null)
    assert.equal(record?.answerHash, `0x${'cd'.repeat(32)}`)
    store.close()
  })

  it('never reverts a settled question', () => {
    const store = new Store(':memory:')
    store.reconcile(0, chain(ALICE, { refunded: true, settledAt: 9 }))
    store.reconcile(0, chain(ALICE))
    assert.equal(store.get(0)?.refunded, true)
    assert.equal(store.isSettled(0), true)
    store.close()
  })
})
