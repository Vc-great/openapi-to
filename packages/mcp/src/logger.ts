import process from 'node:process'

export interface McpLogger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

function safeLogText(value: string, limit = 500): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, (raw) => {
      try {
        const url = new URL(raw)
        url.username = ''
        url.password = ''
        url.search = ''
        return url.toString()
      } catch {
        return '[redacted URL]'
      }
    })
    .replace(/\b(authorization|cookie|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, limit)
}

function safeLogData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? safeLogText(value) : value
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeLogData(item, seen))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/authorization|cookie|token|secret|password|content|preview|environment/i.test(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 30)
      .map(([key, item]) => [key, safeLogData(item, seen)]),
  )
}

export function createStderrLogger(): McpLogger {
  const write = (level: string, message: string, data?: unknown) => {
    const suffix = data === undefined ? '' : ` ${JSON.stringify(safeLogData(data))}`
    process.stderr.write(`[openapi-to-mcp] ${level} ${safeLogText(message)}${suffix}\n`)
  }
  return {
    debug: (message, data) => write('DEBUG', message, data),
    info: (message, data) => write('INFO', message, data),
    warn: (message, data) => write('WARN', message, data),
    error: (message, data) => write('ERROR', message, data),
  }
}

export function redirectIncidentalConsoleToStderr(): void {
  const redirect = (...values: unknown[]) => {
    process.stderr.write(`${values.map((value) => (typeof value === 'string' ? safeLogText(value, 1000) : JSON.stringify(safeLogData(value)))).join(' ')}\n`)
  }
  console.log = redirect
  console.info = redirect
  console.debug = redirect
}
