import { createHash } from 'node:crypto'

import {
  build,
  formatMaterializedArtifacts,
  hasDiagnosticErrors,
  materializeArtifacts,
  type Diagnostic,
  type GenerationManifestEntry,
  type OpenapiToConfigServer,
} from '@openapi-to/core'
import { formatOpenapiToConfig } from '@openapi-to/core/utils'

import { McpToolError } from '../errors.ts'
import type { ResolvedMcpServerOptions } from '../options.ts'
import { sanitizeSourceDisplay } from '../security/source.ts'
import { resolveWorkspacePath, workspaceRelative } from '../security/workspace.ts'
import type { TrustedConfigProvider } from './trusted-config.ts'

export interface GenerationExecution {
  signal?: AbortSignal
  progress?: (stage: string, progress: number, total?: number) => Promise<void>
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

export function manifestHash(entries: readonly GenerationManifestEntry[]): string {
  return createHash('sha256')
    .update(JSON.stringify(entries.map(({ path, status, hash, previousHash, bytes }) => ({ path, status, hash, previousHash, bytes }))))
    .digest('hex')
}

export function generationSucceeded(run: GenerationRun): boolean {
  return !hasDiagnosticErrors(run.diagnostics) && run.servers.every(({ result }) => !result.error)
}
