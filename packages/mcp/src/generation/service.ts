import { createHash } from 'node:crypto'

import {
  build,
  buildFromCompilation,
  formatMaterializedArtifacts,
  hasDiagnosticErrors,
  materializeArtifacts,
  projectOpenAPICompilation,
  type Diagnostic,
  type GenerationManifestEntry,
  type OperationGenerationScope,
  type OpenapiToConfigServer,
  type OutputWriteLock,
  type OpenAPIProjectionStats,
} from '@openapi-to/core'
import { formatOpenapiToConfig } from '@openapi-to/core/utils'

import { McpToolError } from '../errors.ts'
import type { ResolvedMcpServerOptions } from '../options.ts'
import { sanitizeSourceDisplay } from '../security/source.ts'
import { resolveWorkspacePath, workspaceRelative } from '../security/workspace.ts'
import type { TrustedConfigProvider } from './trusted-config.ts'
import type { TrustedTargetCatalogRegistry } from '../catalog/trusted-target-registry.ts'

export interface GenerationExecution {
  signal?: AbortSignal
  progress?: (stage: string, progress: number, total?: number) => Promise<void>
  outputWriteLock?: OutputWriteLock
}

export interface PreparedTarget {
  name: string
  server: OpenapiToConfigServer
}

export interface GenerationRun {
  configPath: string
  targets: string[]
  servers: GenerationServerRun[]
  diagnostics: Diagnostic[]
  selection?: {
    requestedOperationKeys: string[]
    resolvedOperationKeys: string[]
  }
  projection?: {
    stats: OpenAPIProjectionStats
    projectionHash?: string
  }
}

export interface GenerationServerRun {
  name: string
  source: string
  outputRoot: string
  result: Awaited<ReturnType<typeof build>>
  materialized: Awaited<ReturnType<typeof formatMaterializedArtifacts>>['artifacts']
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export async function prepareTargets(provider: TrustedConfigProvider, requested: string[] | undefined, signal?: AbortSignal): Promise<{ configPath: string; config: Awaited<ReturnType<TrustedConfigProvider['get']>>['config']; targets: PreparedTarget[] }> {
  const loaded = await provider.get(signal)
  const targets = loaded.config.servers.map((server, index) => ({ name: server.name || `server${index + 1}`, server }))
  const names = new Set<string>()
  for (const target of targets) {
    if (names.has(target.name)) throw new McpToolError('MCP_CONFIG_LOAD_FAILED', 'Trusted configuration target names must be unique.')
    names.add(target.name)
  }
  const selected = requested?.length ? [...new Set(requested)].sort(compareText) : targets.map(({ name }) => name).sort(compareText)
  for (const name of selected) {
    if (!names.has(name)) throw new McpToolError('MCP_UNKNOWN_TARGET', `Unknown configured generation target: ${name}`)
  }
  return { configPath: loaded.displayPath, config: loaded.config, targets: selected.map((name) => targets.find((target) => target.name === name) as PreparedTarget) }
}

export async function validateConfiguredOutputRoots(provider: TrustedConfigProvider, options: ResolvedMcpServerOptions): Promise<string[]> {
  const prepared = await prepareTargets(provider, undefined)
  if (prepared.targets.length === 0) throw new McpToolError('MCP_CONFIG_LOAD_FAILED', 'Controlled write requires at least one configured generation target.')
  const roots: string[] = []
  for (const target of prepared.targets) {
    const single = formatOpenapiToConfig(options.workspaceRoot, { ...target.server, name: target.name }, prepared.config)
    roots.push(await resolveWorkspacePath(options.workspaceRoot, single.output.dir, { mustExist: false }))
  }
  return [...new Set(roots)].sort(compareText)
}

export async function executeGeneration(
  provider: TrustedConfigProvider,
  options: ResolvedMcpServerOptions,
  requested: string[] | undefined,
  mode: 'dry-run' | 'check',
  execution: GenerationExecution = {},
): Promise<GenerationRun> {
  await execution.progress?.('Loading trusted configuration', 5)
  const prepared = await prepareTargets(provider, requested, execution.signal)
  const servers: GenerationServerRun[] = []
  const diagnostics: Diagnostic[] = []
  for (const target of prepared.targets) {
    if (execution.signal?.aborted) throw execution.signal.reason
    await execution.progress?.('Compiling input and executing plugins', 15 + Math.floor((servers.length / Math.max(1, prepared.targets.length)) * 55))
    const single = formatOpenapiToConfig(options.workspaceRoot, { ...target.server, name: target.name }, prepared.config)
    single.input = { ...single.input, remote: options.remote }
    const safeOutput = await resolveWorkspacePath(options.workspaceRoot, single.output.dir, { mustExist: false })
    single.output = { ...single.output, dir: safeOutput }
    const result = await build(single, {
      json: true,
      dryRun: mode === 'dry-run',
      check: mode === 'check',
      localFileRoot: options.workspaceRoot,
      signal: execution.signal,
      outputWriteLock: execution.outputWriteLock,
    })
    diagnostics.push(...result.diagnostics)
    const generated = result.generationResult?.artifacts ?? []
    const materialized = materializeArtifacts(generated, safeOutput, { signal: execution.signal })
    const formatted = await formatMaterializedArtifacts(materialized.artifacts, single.output.format, { signal: execution.signal })
    servers.push({
      name: target.name,
      source: sanitizeSourceDisplay(options.workspaceRoot, single.input.path),
      outputRoot: workspaceRelative(options.workspaceRoot, safeOutput),
      result,
      materialized: formatted.artifacts,
    })
  }
  await execution.progress?.(mode === 'check' ? 'Comparing generated files' : 'Preparing artifact plan', 85)
  return {
    configPath: prepared.configPath,
    targets: prepared.targets.map(({ name }) => name),
    servers,
    diagnostics,
  }
}

export async function executeSelectiveGeneration(
  provider: TrustedConfigProvider,
  options: ResolvedMcpServerOptions,
  registry: TrustedTargetCatalogRegistry,
  requested: string[] | undefined,
  scope: OperationGenerationScope,
  execution: GenerationExecution = {},
  purpose: 'preview' | 'prepare' = 'preview',
): Promise<GenerationRun> {
  await execution.progress?.('Loading trusted configuration', 5)
  const prepared = await prepareTargets(provider, requested, execution.signal)
  if (prepared.targets.length !== 1) {
    throw new McpToolError(
      'SELECTIVE_GENERATION_SINGLE_TARGET_REQUIRED',
      'Selective generation requires exactly one startup-configured target.',
      'Call openapi_list_targets, then pass one target name.',
    )
  }
  const [target] = prepared.targets
  if (!target) throw new McpToolError('MCP_UNKNOWN_TARGET', 'The selected trusted target was not found.')
  await execution.progress?.('Reusing cached target compilation', 15)
  const cached = await registry.get(target.name, execution.signal)
  if (!cached.catalog || !cached.compilation.document || !cached.success) {
    return { configPath: prepared.configPath, targets: [target.name], servers: [], diagnostics: cached.diagnostics }
  }
  const projected = projectOpenAPICompilation(cached.compilation, cached.catalog, scope, {
    target: target.name,
    sourceHash: cached.sourceHash,
    signal: execution.signal,
  })
  const base: GenerationRun = {
    configPath: prepared.configPath,
    targets: [target.name],
    servers: [],
    diagnostics: projected.diagnostics,
    selection: projected.selection,
    projection: { stats: projected.stats, ...(projected.projectionHash ? { projectionHash: projected.projectionHash } : {}) },
  }
  if (!projected.success || !projected.compilation) return base

  await execution.progress?.('Executing plugins against projected compilation', 50)
  const single = formatOpenapiToConfig(options.workspaceRoot, { ...target.server, name: target.name }, prepared.config)
  single.input = { ...single.input, remote: options.remote }
  const safeOutput = await resolveWorkspacePath(options.workspaceRoot, single.output.dir, { mustExist: false })
  // An ad-hoc selective preview must never propose deletion of unselected
  // managed artifacts. Selective Prepare instead generates the complete desired
  // persisted selection and therefore preserves the trusted cleanup setting.
  single.output = purpose === 'preview'
    ? { ...single.output, dir: safeOutput, clean: false }
    : { ...single.output, dir: safeOutput }
  const result = await buildFromCompilation(single, projected.compilation, {
    json: true,
    dryRun: true,
    localFileRoot: options.workspaceRoot,
    signal: execution.signal,
  })
  const generated = result.generationResult?.artifacts ?? []
  const materialized = materializeArtifacts(generated, safeOutput, { signal: execution.signal })
  const formatted = await formatMaterializedArtifacts(materialized.artifacts, single.output.format, { signal: execution.signal })
  return {
    ...base,
    servers: [{
      name: target.name,
      source: sanitizeSourceDisplay(options.workspaceRoot, single.input.path),
      outputRoot: workspaceRelative(options.workspaceRoot, safeOutput),
      result,
      materialized: formatted.artifacts,
    }],
    diagnostics: result.diagnostics,
  }
}

export function manifestHash(entries: readonly GenerationManifestEntry[]): string {
  return createHash('sha256')
    .update(JSON.stringify(entries.map(({ path, status, hash, previousHash, bytes }) => ({ path, status, hash, previousHash, bytes }))))
    .digest('hex')
}

export function generationSucceeded(run: GenerationRun): boolean {
  return !hasDiagnosticErrors(run.diagnostics) && run.servers.every(({ result }) => !result.error)
}
