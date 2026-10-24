export class Semaphore {
  private available: number
  private readonly waiters: Array<() => void> = []

  constructor(limit: number) {
    this.available = limit
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.available > 0) {
      this.available -= 1
    } else {
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    try {
      return await task()
    } finally {
      const next = this.waiters.shift()
      if (next) next()
      else this.available += 1
    }
  }
}

export class Mutex {
  private readonly gate = new Semaphore(1)

  run<T>(task: () => Promise<T>): Promise<T> {
    return this.gate.run(task)
  }
}

export async function runPool<T>(
  items: readonly T[],
  size: number,
  worker: (item: T) => Promise<unknown>,
): Promise<void> {
  let index = 0
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index]
      index += 1
      if (item !== undefined) await worker(item)
    }
  })
  await Promise.all(lanes)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
