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
  const server = createOpenapiToMcpServer({
    workspaceRoot: parsed.values['workspace-root'] ?? process.cwd(),
    ...(parsed.values.config ? { configPath: parsed.values.config } : {}),
    remote: {
      allowPrivateNetwork: parsed.values['allow-private-network'],
      allowedHosts: parsed.values['allow-host'] ?? [],
    },
  })
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(() => {
  process.stderr.write('[openapi-to-mcp] ERROR Unable to start server.\n')
  process.exitCode = 1
})
