import { keccak256, stringToBytes } from 'viem'
import type { Hex } from 'viem'
import { askedEvent, pennyOracleAbi, refundedEvent } from './abi.ts'
import type { Answerer } from './ai.ts'
import type { Clients } from './chain.ts'
import type { Config } from './config.ts'
import { log } from './log.ts'
import type { Store } from './store.ts'
import type { ChainQuestion } from './types.ts'
import { Mutex, Semaphore, runPool, sleep } from './util.ts'

export type ProcessResult = 'fulfilled' | 'skipped' | 'busy' | 'failed'

export interface OracleOptions {
  sweepIntervalMs?: number
  pollIntervalMs?: number
  logRange?: bigint
  aiConcurrency?: number
  sweepConcurrency?: number
  receiptTimeoutMs?: number
}

const CURSOR_KEY = 'log_cursor'

export class OracleService {
  private readonly inFlight = new Set<number>()
  private readonly aiGate: Semaphore
  private readonly txLock = new Mutex()
  private readonly sweepIntervalMs: number
  private readonly pollIntervalMs: number
  private readonly logRange: bigint
  private readonly sweepConcurrency: number
  private readonly receiptTimeoutMs: number
  private sweeping = false
  private running = false
  private sweepTimer: NodeJS.Timeout | undefined
  private readonly background = new Set<Promise<unknown>>()
  private lastBlock: bigint | undefined

  constructor(
    private readonly config: Config,
    private readonly clients: Clients,
    private readonly store: Store,
    private readonly answer: Answerer,
    options: OracleOptions = {},
  ) {
    this.sweepIntervalMs = options.sweepIntervalMs ?? 30_000
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000
    this.logRange = options.logRange ?? 2_000n
    this.aiGate = new Semaphore(options.aiConcurrency ?? 3)
    this.sweepConcurrency = options.sweepConcurrency ?? 4
    this.receiptTimeoutMs = options.receiptTimeoutMs ?? 120_000
  }

  get cursor(): bigint | undefined {
    return this.lastBlock
  }

  get inFlightCount(): number {
    return this.inFlight.size
  }

  async readQuestion(id: number): Promise<ChainQuestion> {
    const value = await this.clients.publicClient.readContract({
      address: this.config.contractAddress,
      abi: pennyOracleAbi,
      functionName: 'getQuestion',
      args: [BigInt(id)],
    })
    return {
      asker: value.asker,
      question: value.question,
      answerHash: value.answerHash,
      fulfilled: value.fulfilled,
      refunded: value.refunded,
      askedAt: Number(value.askedAt),
      settledAt: Number(value.settledAt),
    }
  }

  async sync(id: number): Promise<ChainQuestion> {
    const chain = await this.readQuestion(id)
    this.store.reconcile(id, chain)
    return chain
  }

  async processQuestion(id: number): Promise<ProcessResult> {
    if (this.inFlight.has(id)) return 'busy'
    this.inFlight.add(id)
    try {
      const chain = await this.sync(id)
      if (chain.fulfilled || chain.refunded) return 'skipped'

      const hash = await this.prepareAnswer(id, chain.question)

      const latest = await this.sync(id)
      if (latest.fulfilled || latest.refunded) return 'skipped'

      await this.submitFulfillment(id, hash)
      await this.sync(id)
      log.info(`Question ${id} fulfilled`)
      return 'fulfilled'
    } catch (error) {
      log.error(`Question ${id} could not be processed`, error)
      return 'failed'
    } finally {
      this.inFlight.delete(id)
    }
  }

  private async prepareAnswer(id: number, question: string): Promise<Hex> {
    const existing = this.store.draft(id)
    if (existing) return keccak256(stringToBytes(existing.answer))
    const text = await this.aiGate.run(() => this.answer(question))
    const hash = keccak256(stringToBytes(text))
    this.store.saveDraft(id, text, hash)
    return hash
  }

  private submitFulfillment(id: number, hash: Hex): Promise<void> {
    return this.txLock.run(async () => {
      const { publicClient, walletClient, account } = this.clients
      const { request } = await publicClient.simulateContract({
        account,
        address: this.config.contractAddress,
        abi: pennyOracleAbi,
        functionName: 'fulfill',
        args: [BigInt(id), hash],
      })
      const txHash = await walletClient.writeContract(request)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: this.receiptTimeoutMs,
      })
      if (receipt.status !== 'success') throw new Error(`fulfill transaction ${txHash} reverted`)
    })
  }

  async sweep(): Promise<void> {
    if (this.sweeping) return
    this.sweeping = true
    try {
      const next = await this.clients.publicClient.readContract({
        address: this.config.contractAddress,
        abi: pennyOracleAbi,
        functionName: 'nextId',
      })
      const total = Number(next)
      const ids: number[] = []
      for (let id = 0; id < total; id += 1) {
        if (!this.store.isSettled(id)) ids.push(id)
      }
      if (ids.length > 0) log.info(`Recovery sweep checking ${ids.length} unsettled question(s)`)
      await runPool(ids, this.sweepConcurrency, (id) => this.processQuestion(id))
    } catch (error) {
      log.error('Recovery sweep failed', error)
    } finally {
      this.sweeping = false
    }
  }

  private async initCursor(): Promise<void> {
    const stored = this.store.getMeta(CURSOR_KEY)
    if (stored !== undefined) {
      this.lastBlock = BigInt(stored)
      return
    }
    const head = await this.clients.publicClient.getBlockNumber()
    this.lastBlock = head
    this.store.setMeta(CURSOR_KEY, head.toString())
  }

  async scanLogs(): Promise<void> {
    if (this.lastBlock === undefined) await this.initCursor()
    const cursor = this.lastBlock
    if (cursor === undefined) return
    const head = await this.clients.publicClient.getBlockNumber()
    let from = cursor + 1n
    while (from <= head) {
      const to = from + this.logRange - 1n < head ? from + this.logRange - 1n : head
      const logs = await this.clients.publicClient.getLogs({
        address: this.config.contractAddress,
        events: [askedEvent, refundedEvent],
        fromBlock: from,
        toBlock: to,
      })
      for (const entry of logs) {
        const id = Number(entry.args.id)
        if (entry.eventName === 'Asked') {
          this.track(this.processQuestion(id))
        } else {
          this.track(
            this.sync(id).catch((error: unknown) => log.error(`Refund sync failed for question ${id}`, error)),
          )
        }
      }
      this.lastBlock = to
      this.store.setMeta(CURSOR_KEY, to.toString())
      from = to + 1n
    }
  }

  private track(work: Promise<unknown>): void {
    this.background.add(work)
    void work.finally(() => this.background.delete(work))
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    await this.initCursor()
    this.track(this.sweep())
    this.sweepTimer = setInterval(() => {
      this.track(this.sweep())
    }, this.sweepIntervalMs)
    void this.pollLoop()
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.scanLogs()
      } catch (error) {
        log.error('Log scan failed', error)
      }
      await sleep(this.pollIntervalMs)
    }
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    await Promise.allSettled([...this.background])
  }
}
