import {
  buildOperationCatalog,
  compileOpenAPI,
  type Diagnostic,
  type OpenAPICompilation,
  type OperationCatalog,
} from '@openapi-to/core'
import { formatOpenapiToConfig } from '@openapi-to/core/utils'

import type { ResolvedMcpServerOptions } from '../options.ts'
import { prepareTargets, type PreparedTarget } from '../generation/service.ts'
import type { TrustedConfigProvider } from '../generation/trusted-config.ts'
import { McpToolError } from '../errors.ts'

export interface CompiledTargetCatalog {
  target: string
  sourceType: 'local' | 'remote'
  sourceHash?: string
  success: boolean
  compilation: OpenAPICompilation
  catalog?: OperationCatalog
  schemaCount: number
  diagnostics: Diagnostic[]
}

type CompileOpenAPI = typeof compileOpenAPI

function sourceType(source: string): 'local' | 'remote' {
  try {
    const url = new URL(source)
    return url.protocol === 'http:' || url.protocol === 'https:' ? 'remote' : 'local'
  } catch {
    return 'local'
  }
}

function schemaCount(compilation: OpenAPICompilation): number {
  const root = compilation.normalizedDocument as Record<string, unknown> | undefined
  const components = typeof root?.components === 'object' && root.components !== null ? (root.components as Record<string, unknown>) : undefined
  const schemas = typeof components?.schemas === 'object' && components.schemas !== null ? (components.schemas as Record<string, unknown>) : undefined
  return Object.keys(schemas ?? {}).length
}

/** Process-local catalog cache. Trusted config and source changes are observed after server restart. */
export class TrustedTargetCatalogRegistry {
  private readonly cache = new Map<string, Promise<CompiledTargetCatalog>>()

  constructor(
    private readonly provider: TrustedConfigProvider,
    private readonly options: ResolvedMcpServerOptions,
    private readonly compile: CompileOpenAPI = compileOpenAPI,
  ) {}

  clear(): void {
    this.cache.clear()
  }

  async targetNames(signal?: AbortSignal): Promise<string[]> {
    const prepared = await prepareTargets(this.provider, undefined, signal)
    return prepared.targets.map(({ name }) => name).sort()
  }

  async resolveTargetName(requested: string | undefined, signal?: AbortSignal): Promise<string> {
    const names = await this.targetNames(signal)
    if (requested) {
      if (!names.includes(requested)) throw new McpToolError('MCP_UNKNOWN_TARGET', `Unknown configured target: ${requested}`)
      return requested
    }
    const [onlyTarget] = names
    if (names.length === 1 && onlyTarget) return onlyTarget
    if (names.length === 0) throw new McpToolError('MCP_CONFIG_NO_TARGETS', 'The trusted configuration has no OpenAPI targets.')
    throw new McpToolError('MCP_TARGET_REQUIRED', 'A target is required when the trusted configuration contains multiple targets.', 'Call openapi_list_targets, then select one returned target name.')
  }

  async get(requested: string | undefined, signal?: AbortSignal): Promise<CompiledTargetCatalog> {
    const target = await this.resolveTargetName(requested, signal)
    const prepared = await prepareTargets(this.provider, [target], signal)
    const [selected] = prepared.targets
    if (!selected) throw new McpToolError('MCP_UNKNOWN_TARGET', `Unknown configured target: ${target}`)
    const key = this.cacheKey(prepared.configPath, selected)
    const cached = this.cache.get(key)
    if (cached) return this.waitFor(cached, signal)
    const pending = this.compileTarget(selected, signal)
    this.cache.set(key, pending)
    void pending.then(
      (result) => {
        if (!result.success && this.cache.get(key) === pending) this.cache.delete(key)
      },
      () => {
        if (this.cache.get(key) === pending) this.cache.delete(key)
      },
    )
    return this.waitFor(pending, signal)
  }

  async list(signal?: AbortSignal): Promise<CompiledTargetCatalog[]> {
    const names = await this.targetNames(signal)
    return Promise.all(names.map((name) => this.get(name, signal)))
  }

  private cacheKey(configPath: string, target: PreparedTarget): string {
    return `${configPath}\0${target.name}\0${target.server.input.path}`
  }

  private async compileTarget(target: PreparedTarget, signal?: AbortSignal): Promise<CompiledTargetCatalog> {
    const loaded = await this.provider.get(signal)
    const single = formatOpenapiToConfig(this.options.workspaceRoot, { ...target.server, name: target.name }, loaded.config)
    const compilation = await this.compile(single.input.path, {
      cwd: this.options.workspaceRoot,
      localFileRoot: this.options.workspaceRoot,
      remote: this.options.remote,
      signal,
    })
    const rootSnapshot = compilation.references?.sourceSnapshots.find((snapshot) => snapshot.isRoot)
    const catalog = compilation.document
      ? buildOperationCatalog(compilation.document, {
          target: target.name,
          resolvedDocument: compilation.normalizedDocument ?? compilation.resolvedDocument,
          diagnostics: compilation.diagnostics,
          signal,
        })
      : undefined
    return {
      target: target.name,
      sourceType: sourceType(single.input.path),
      ...(rootSnapshot ? { sourceHash: rootSnapshot.sha256 } : {}),
      success: compilation.success && catalog !== undefined,
      compilation,
      ...(catalog ? { catalog } : {}),
      schemaCount: schemaCount(compilation),
      diagnostics: catalog?.diagnostics ?? compilation.diagnostics,
    }
  }

  private async waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise
    if (signal.aborted) throw signal.reason
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }
}
