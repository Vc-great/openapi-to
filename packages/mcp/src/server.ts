import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { version } from '../package.json'
import { GenerationLock } from './generation/generation-lock.ts'
import { TrustedConfigProvider } from './generation/trusted-config.ts'
import { createStderrLogger } from './logger.ts'
import { resolveMcpServerOptions, type OpenapiToMcpServerOptions } from './options.ts'
import { registerReadOnlyTools } from './tools/index.ts'

export function createOpenapiToMcpServer(options: OpenapiToMcpServerOptions): McpServer {
  const resolved = resolveMcpServerOptions(options)
  const server = new McpServer(
    { name: '@openapi-to/mcp', version },
    {
      instructions: 'Read-only OpenAPI compiler tools. No tool writes, deletes, repairs, or overwrites files. Local paths and transitive references are confined to the startup Workspace. Generation tools, when present, use only the trusted startup configuration. Results are bounded and may report truncation.',
    },
  )
  registerReadOnlyTools(server, {
    options: resolved,
    logger: createStderrLogger({ format: resolved.logFormat, level: resolved.logLevel }),
    trustedConfig: new TrustedConfigProvider(resolved.workspaceRoot, resolved.configPath),
    generationLock: new GenerationLock(),
  })
  return server
}
