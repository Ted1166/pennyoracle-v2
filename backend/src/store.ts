import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { ChainQuestion, QuestionRecord } from './types.ts'

interface Row {
  id: number
  asker: string
  question: string
  asked_at: number
  answer: string | null
  answer_hash: string | null
  fulfilled: number
  refunded: number
  fulfilled_at: number | null
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  asker TEXT NOT NULL,
  asker_lc TEXT NOT NULL,
  question TEXT NOT NULL,
  asked_at INTEGER NOT NULL,
  answer TEXT,
  answer_hash TEXT,
  fulfilled INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  fulfilled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_asker ON questions (asker_lc, id DESC);
CREATE INDEX IF NOT EXISTS idx_questions_fulfilled ON questions (fulfilled, id DESC);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

function toRecord(row: Row): QuestionRecord {
  const fulfilled = row.fulfilled === 1
  return {
    id: row.id,
    asker: row.asker,
    question: row.question,
    answer: fulfilled ? row.answer : null,
    answerHash: fulfilled ? row.answer_hash : null,
    fulfilled,
    refunded: row.refunded === 1,
    askedAt: row.asked_at,
    fulfilledAt: fulfilled ? row.fulfilled_at : null,
  }
}

export class Store {
  private readonly db: Database.Database

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.exec(SCHEMA)
  }

  close(): void {
    this.db.close()
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  get(id: number): QuestionRecord | undefined {
    const row = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as Row | undefined
    return row ? toRecord(row) : undefined
  }

  draft(id: number): { answer: string; answerHash: string } | undefined {
    const row = this.db.prepare('SELECT answer, answer_hash FROM questions WHERE id = ?').get(id) as
      | { answer: string | null; answer_hash: string | null }
      | undefined
    if (!row?.answer || !row.answer_hash) return undefined
    return { answer: row.answer, answerHash: row.answer_hash }
  }

  isSettled(id: number): boolean {
    const row = this.db.prepare('SELECT fulfilled, refunded FROM questions WHERE id = ?').get(id) as
      | { fulfilled: number; refunded: number }
      | undefined
    return Boolean(row && (row.fulfilled === 1 || row.refunded === 1))
  }

  saveDraft(id: number, answer: string, answerHash: string): void {
    this.db
      .prepare('UPDATE questions SET answer = ?, answer_hash = ?, updated_at = ? WHERE id = ? AND fulfilled = 0')
      .run(answer, answerHash, Date.now(), id)
  }

  reconcile(id: number, chain: ChainQuestion): void {
    const now = Date.now()
    const apply = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO questions (id, asker, asker_lc, question, asked_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
        )
        .run(id, chain.asker, chain.asker.toLowerCase(), chain.question, chain.askedAt, now, now)

      if (chain.refunded) {
        this.db.prepare('UPDATE questions SET refunded = 1, updated_at = ? WHERE id = ?').run(now, id)
      }

      if (chain.fulfilled) {
        const row = this.db.prepare('SELECT answer, answer_hash FROM questions WHERE id = ?').get(id) as {
          answer: string | null
          answer_hash: string | null
        }
        const matches = row.answer !== null && row.answer_hash?.toLowerCase() === chain.answerHash.toLowerCase()
        this.db
          .prepare(
            'UPDATE questions SET fulfilled = 1, answer = ?, answer_hash = ?, fulfilled_at = ?, updated_at = ? WHERE id = ?',
          )
          .run(matches ? row.answer : null, chain.answerHash, chain.settledAt, now, id)
      }
    })
    apply()
  }

  feed(limit: number, offset: number): QuestionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM questions WHERE fulfilled = 1 ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as Row[]
    return rows.map(toRecord)
  }

  history(address: string): QuestionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM questions WHERE asker_lc = ? ORDER BY id DESC')
      .all(address.toLowerCase()) as Row[]
    return rows.map(toRecord)
  }

  pendingCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM questions WHERE fulfilled = 0 AND refunded = 0').get() as {
      n: number
    }
    return row.n
  }
}
