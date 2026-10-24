import cors from 'cors'
import express from 'express'
import type { Express, NextFunction, Request, Response } from 'express'
import { isAddress } from 'viem'
import { log } from './log.ts'
import type { Store } from './store.ts'

export interface HealthSource {
  chainId: number
  contractAddress: string
  oracleAddress: string
  cursor: () => bigint | undefined
  inFlight: () => number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function parseNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return undefined
  return Number(value)
}

export function createApp(store: Store, health: HealthSource): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors())

  app.get('/health', (_req: Request, res: Response) => {
    const cursor = health.cursor()
    res.json({
      ok: true,
      chainId: health.chainId,
      contract: health.contractAddress,
      oracle: health.oracleAddress,
      lastScannedBlock: cursor === undefined ? null : cursor.toString(),
      pending: store.pendingCount(),
      processing: health.inFlight(),
      uptimeSeconds: Math.floor(process.uptime()),
    })
  })

  app.get('/feed', (req: Request, res: Response) => {
    const rawLimit = req.query.limit
    const rawOffset = req.query.offset
    const limit = rawLimit === undefined ? DEFAULT_LIMIT : parseNonNegativeInt(rawLimit)
    const offset = rawOffset === undefined ? 0 : parseNonNegativeInt(rawOffset)
    if (limit === undefined || offset === undefined || limit < 1) {
      res.status(400).json({ error: 'limit must be a positive integer and offset a non-negative integer' })
      return
    }
    res.json(store.feed(Math.min(limit, MAX_LIMIT), offset))
  })

  app.get('/history/:address', (req: Request, res: Response) => {
    const address = req.params.address
    if (typeof address !== 'string' || !isAddress(address, { strict: false })) {
      res.status(400).json({ error: 'address must be a valid address' })
      return
    }
    res.json(store.history(address))
  })

  app.get('/question/:id', (req: Request, res: Response) => {
    const id = parseNonNegativeInt(req.params.id)
    if (id === undefined) {
      res.status(400).json({ error: 'id must be a non-negative integer' })
      return
    }
    const record = store.get(id)
    if (!record) {
      res.status(404).json({ error: 'question not found' })
      return
    }
    res.json(record)
  })

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' })
  })

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error('Request failed', error)
    res.status(500).json({ error: 'internal error' })
  })

  return app
}
