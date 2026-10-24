const encoder = new TextEncoder()

export function byteLength(value: string): number {
  return encoder.encode(value).length
}

export function clampToBytes(value: string, max: number): string {
  if (byteLength(value) <= max) return value
  let out = ''
  let used = 0
  for (const char of value) {
    const size = encoder.encode(char).length
    if (used + size > max) break
    out += char
    used += size
  }
  return out
}
