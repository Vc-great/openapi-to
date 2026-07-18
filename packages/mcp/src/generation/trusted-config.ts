import { loadOpenapiConfig, type LoadedOpenapiConfig } from '@openapi-to/core'

import { McpToolError } from '../errors.ts'
import { resolveTrustedConfigPath } from '../security/config.ts'

export class TrustedConfigProvider {
  readonly configured: boolean
  private readonly loaded?: Promise<LoadedOpenapiConfig & { displayPath: string }>

  constructor(workspaceRoot: string, configPath?: string) {
    this.configured = configPath !== undefined
    if (configPath) {
      this.loaded = (async () => {
        try {
          const trusted = await resolveTrustedConfigPath(workspaceRoot, configPath)
          const loaded = await loadOpenapiConfig({
            cwd: workspaceRoot,
            configPath: trusted.absolutePath,
            localFileRoot: workspaceRoot,
          })
          return { ...loaded, displayPath: trusted.displayPath }
        } catch {
          throw new McpToolError('MCP_CONFIG_LOAD_FAILED', 'The startup-configured OpenAPI configuration could not be loaded safely.')
        }
      })()
      // The trusted config is loaded eagerly and consumed lazily by generation tools.
      // Mark rejection as observed so a config error cannot terminate an idle stdio server.
      void this.loaded.catch(() => undefined)
    }
  }

  async get(signal?: AbortSignal): Promise<LoadedOpenapiConfig & { displayPath: string }> {
    if (!this.loaded) throw new McpToolError('MCP_CONFIG_NOT_AVAILABLE', 'Generation tools require a trusted configuration fixed at server startup.')
    if (!signal) return this.loaded
    if (signal.aborted) throw signal.reason
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      this.loaded?.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }
}
