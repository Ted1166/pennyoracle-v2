let secrets: string[] = []

export function registerSecrets(values: readonly string[]): void {
  secrets = values.filter((value) => value.length >= 8)
}

export function redact(text: string): string {
  let out = text
  for (const secret of secrets) out = out.split(secret).join('[redacted]')
  return out
}

function describe(value: unknown): string {
  if (value instanceof Error) {
    const cause = value.cause instanceof Error ? ` (cause: ${value.cause.message})` : ''
    return `${value.name}: ${value.message}${cause}`
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function emit(level: 'info' | 'warn' | 'error', message: string, detail?: unknown): void {
  const suffix = detail === undefined ? '' : ` ${describe(detail)}`
  const line = redact(`${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}`)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (message: string, detail?: unknown) => emit('info', message, detail),
  warn: (message: string, detail?: unknown) => emit('warn', message, detail),
  error: (message: string, detail?: unknown) => emit('error', message, detail),
}
