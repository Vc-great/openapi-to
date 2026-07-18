import process from 'node:process'
import { parseArgs } from 'node:util'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { version } from '../package.json'
import { createOpenapiToMcpServer } from './server.ts'
import { redirectIncidentalConsoleToStderr } from './logger.ts'

const HELP = `openapi-to-mcp — read-only OpenAPI MCP server

Usage:
  openapi-to-mcp [--workspace-root <path>] [--config <path>]

Options:
  --workspace-root <path>    Workspace boundary (default: current directory)
  --config <path>            Trusted project config fixed for the server lifetime
  --allow-host <hostname>    Allow a remote OpenAPI host (repeatable)
  --allow-private-network    Allow private-network sources; lowers the security boundary and is disabled by default
  --validate-timeout-ms <n>  Server timeout for validate in milliseconds (100..600000; default 30000)
  --inspect-timeout-ms <n>   Server timeout for inspect in milliseconds (100..600000; default 30000)
  --diff-timeout-ms <n>      Server timeout for diff in milliseconds (100..600000; default 45000)
  --generation-timeout-ms <n> Server timeout for dry-run/check in milliseconds (100..600000; default 60000)
  --log-format <text|json>   Operational stderr log format (default: text)
  --log-level <level>        debug, info, warn, error, or silent (default: info)
  --help                     Show help
  --version                  Show version

The server uses stdio: stdin/stdout are reserved for MCP JSON-RPC and logs go to stderr.
`

async function main(): Promise<void> {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: false,
    options: {
      'workspace-root': { type: 'string' },
      config: { type: 'string' },
      'allow-host': { type: 'string', multiple: true },
      'allow-private-network': { type: 'boolean', default: false },
      'validate-timeout-ms': { type: 'string' },
      'inspect-timeout-ms': { type: 'string' },
      'diff-timeout-ms': { type: 'string' },
      'generation-timeout-ms': { type: 'string' },
      'log-format': { type: 'string' },
      'log-level': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  })
  if (parsed.values.help) {
    process.stdout.write(HELP)
    return
  }
  if (parsed.values.version) {
    process.stdout.write(`${version}\n`)
    return
  }
  redirectIncidentalConsoleToStderr()
  const numberValue = (value: string | undefined) => (value === undefined ? undefined : Number(value))
  const logFormat = parsed.values['log-format']
  if (logFormat !== undefined && logFormat !== 'text' && logFormat !== 'json') throw new Error('--log-format must be text or json.')
  const logLevel = parsed.values['log-level']
  if (logLevel !== undefined && !['debug', 'info', 'warn', 'error', 'silent'].includes(logLevel)) throw new Error('--log-level must be debug, info, warn, error, or silent.')
  const server = createOpenapiToMcpServer({
    workspaceRoot: parsed.values['workspace-root'] ?? process.cwd(),
    ...(parsed.values.config ? { configPath: parsed.values.config } : {}),
    remote: {
      allowPrivateNetwork: parsed.values['allow-private-network'],
      allowedHosts: parsed.values['allow-host'] ?? [],
    },
    timeouts: {
      validateMs: numberValue(parsed.values['validate-timeout-ms']),
      inspectMs: numberValue(parsed.values['inspect-timeout-ms']),
      diffMs: numberValue(parsed.values['diff-timeout-ms']),
      generationMs: numberValue(parsed.values['generation-timeout-ms']),
    },
    ...(logFormat ? { logFormat } : {}),
    ...(logLevel ? { logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error' | 'silent' } : {}),
  })
  const transport = new StdioServerTransport()
  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    await server.close()
  }
  process.stdin.once('end', () => { void shutdown() })
  process.once('SIGTERM', () => { void shutdown() })
  process.once('SIGINT', () => { void shutdown() })
  await server.connect(transport)
}

main().catch(() => {
  process.stderr.write('[openapi-to-mcp] ERROR Unable to start server.\n')
  process.exitCode = 1
})
