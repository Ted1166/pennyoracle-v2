import { formatUnits } from 'viem'

export const USDC_DECIMALS = 6

export function formatUsdc(raw: bigint): string {
  return formatUnits(raw, USDC_DECIMALS)
}

export function shortAddress(value: string): string {
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function shortHash(value: string): string {
  if (value.length < 20) return value
  return `${value.slice(0, 10)}…${value.slice(-8)}`
}

export function timeAgo(seconds: number, now: number): string {
  const delta = Math.max(0, now - seconds)
  if (delta < 60) return 'just now'
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s === 0 ? `${m}m` : `${m}m ${s}s`
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  return h === 0 ? `${d}d` : `${d}d ${h}h`
}
