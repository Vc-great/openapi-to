import { createHash } from 'node:crypto'
import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

import {
  acquireOutputWriteLock,
  commitOutputTransaction,
  OPERATION_SELECTION_MANIFEST_VERSION,
  snapshotOutputFile,
  type ConfigSourceSnapshot,
  type FileIdentity,
  type GenerationManifest,
  type MaterializedArtifact,
  type OutputFileSnapshot,
  type OutputWriteLock,
  OutputRecoveryRequiredError,
  OutputTransactionRollbackError,
  OutputTransactionRolledBackError,
  type SourceSnapshot,
  type OperationSelectionMutation,
  type OpenAPIProjectionStats,
} from '@openapi-to/core'

import { version } from '../../package.json'
import { McpToolError } from '../errors.ts'
import type { McpLogger } from '../logger.ts'
import type { ResolvedMcpServerOptions } from '../options.ts'
import { workspaceRelative } from '../security/workspace.ts'
import type { TrustedTargetCatalogRegistry } from '../catalog/trusted-target-registry.ts'
import { executeGeneration, executeSelectiveGeneration, generationSucceeded, type GenerationExecution, type GenerationRun } from './service.ts'
import type { GenerationPlanStore, StoredGenerationPlan } from './plan-store.ts'
import { prepareOperationSelection, type PreparedOperationSelection } from './selection-state.ts'
import type { TrustedConfigProvider } from './trusted-config.ts'

interface DirectorySnapshot {
  exists: boolean
  realPathHash: string
  identity?: Pick<FileIdentity, 'device' | 'inode'>
}

interface PlanSourceSnapshot {
  displayPath: string
  uriKind: 'local' | 'remote' | 'memory'
  isRoot: boolean
  sha256: string
  bytes: number
  identity?: FileIdentity
}

interface PlanFileState extends OutputFileSnapshot {
  path: string
}

interface PlanArtifact {
  path: string
  kind: string
  sha256: string
  bytes: number
}

interface SelectivePlanBinding {
  selectionManifestVersion: typeof OPERATION_SELECTION_MANIFEST_VERSION
  selectionOwner: string
  selectionFileIdentity: string
  previousSelectionExists: boolean
  previousSelectionHash: string
  requestedOperationKeys: string[]
  newlyAddedOperationKeys: string[]
  alreadySelectedOperationKeys: string[]
  desiredOperationKeys: string[]
  desiredSelectionHash: string
  projectionHash: string
  projection: OpenAPIProjectionStats
}

interface DeterministicGenerationPlan {
  schemaVersion: 1
  kind: 'full' | 'selective'
  generatorVersion: string
  workspace: DirectorySnapshot
  config: {
    path: string
    semanticHash: string
    sources: Array<{ path: string; sha256: string; bytes: number; identity: FileIdentity }>
  }
  target: string
  remotePolicyHash: string
  sources: PlanSourceSnapshot[]
  output: {
    root: string
    identity: DirectorySnapshot
    ownershipManifest: OutputFileSnapshot
    files: PlanFileState[]
    artifacts: PlanArtifact[]
    manifest: GenerationManifest
  }
  selection?: SelectivePlanBinding
}

export interface InternalGenerationWritePlan extends StoredGenerationPlan {
  kind: 'full' | 'selective'
  deterministic: DeterministicGenerationPlan
}

export interface PreparedGenerationPlan {
  stored: InternalGenerationWritePlan
  token: string
  run: GenerationRun
}

export interface AppliedGenerationPlan {
  plan: InternalGenerationWritePlan
  transactionId: string
  summary: { added: number; modified: number; deleted: number; unchanged: number }
  changedFiles: Array<{ path: string; status: 'added' | 'modified' }>
  deletedFiles: string[]
  rollbackPerformed: boolean
  cancelledDuringCommit: boolean
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'function') return { functionSha256: hash(Function.prototype.toString.call(value)) }
  if (value === undefined) return '[undefined]'
  if (typeof value === 'bigint') return value.toString()
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => stableValue(item, seen))
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => compareText(left, right)).map(([key, item]) => [key, stableValue(item, seen)]))
}

function stableJSON(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

/** @internal Deterministic semantic plan hash used by focused binding tests. */
export function hashDeterministicGenerationPlan(plan: DeterministicGenerationPlan): string {
  return hash(stableJSON(plan))
}

async function directorySnapshot(directory: string, workspaceRoot: string): Promise<DirectorySnapshot> {
  try {
    const metadata = await lstat(directory, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new McpToolError('MCP_PLAN_OUTPUT_CHANGED', 'The output root is not a real directory; prepare a new plan.')
    const canonical = await realpath(directory)
    return {
      exists: true,
      realPathHash: hash(canonical),
      identity: {
        device: metadata.dev.toString(),
        inode: metadata.ino.toString(),
      },
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    let ancestor = path.dirname(directory)
    for (;;) {
      try {
        const canonical = await realpath(ancestor)
        return { exists: false, realPathHash: hash(`${canonical}/${workspaceRelative(workspaceRoot, directory)}`) }
      } catch (ancestorError) {
        if ((ancestorError as NodeJS.ErrnoException).code !== 'ENOENT') throw ancestorError
        const parent = path.dirname(ancestor)
        if (parent === ancestor) throw new McpToolError('MCP_PLAN_OUTPUT_CHANGED', 'The output root has no stable existing ancestor.')
        ancestor = parent
      }
    }
  }
}

async function stableFileSnapshot(filePath: string): Promise<OutputFileSnapshot> {
  return snapshotOutputFile(filePath)
}

async function currentConfigSources(workspaceRoot: string, sources: readonly ConfigSourceSnapshot[]) {
  const current = []
  for (const source of sources) {
    const snapshot = await stableFileSnapshot(source.path)
    if (!snapshot.exists || !snapshot.identity || !snapshot.sha256 || snapshot.bytes === undefined) {
      throw new McpToolError('MCP_PLAN_CONFIG_CHANGED', 'A trusted configuration source is missing; prepare a new plan.')
    }
    current.push({
      path: workspaceRelative(workspaceRoot, source.path),
      sha256: snapshot.sha256,
      bytes: snapshot.bytes,
      identity: snapshot.identity,
    })
  }
  return current.sort((left, right) => compareText(left.path, right.path))
}

function planSource(workspaceRoot: string, snapshot: SourceSnapshot): PlanSourceSnapshot {
  const url = new URL(snapshot.uri)
  const uriKind = url.protocol === 'file:' ? 'local' : url.protocol === 'http:' || url.protocol === 'https:' ? 'remote' : 'memory'
  return {
    displayPath: uriKind === 'local' ? workspaceRelative(workspaceRoot, snapshot.source) : uriKind === 'remote' ? `${url.protocol}//${url.host}${url.pathname}` : '<memory>',
    uriKind,
    isRoot: snapshot.isRoot === true,
    sha256: snapshot.sha256,
    bytes: snapshot.bytes,
    ...(snapshot.localIdentity
      ? {
          identity: {
            device: snapshot.localIdentity.device,
            inode: snapshot.localIdentity.inode,
            size: snapshot.localIdentity.size,
            modifiedNanoseconds: snapshot.localIdentity.modifiedNanoseconds,
          },
        }
      : {}),
  }
}

async function outputFileStates(outputRoot: string, manifest: GenerationManifest): Promise<PlanFileState[]> {
  const files: PlanFileState[] = []
  for (const entry of manifest.entries) {
    const snapshot = await stableFileSnapshot(path.resolve(outputRoot, ...entry.path.split('/')))
    files.push({ path: entry.path, ...snapshot })
  }
  return files.sort((left, right) => compareText(left.path, right.path))
}

function planArtifacts(artifacts: readonly MaterializedArtifact[]): PlanArtifact[] {
  return artifacts
    .map((artifact) => ({ path: artifact.relativePath, kind: artifact.kind, sha256: artifact.hash, bytes: artifact.content.byteLength }))
    .sort((left, right) => compareText(left.path, right.path))
}

async function deterministicPlan(
  provider: TrustedConfigProvider,
  options: ResolvedMcpServerOptions,
  requested: string[] | undefined,
  execution: GenerationExecution,
): Promise<{ deterministic: DeterministicGenerationPlan; run: GenerationRun }> {
  const run = await executeGeneration(provider, options, requested, 'dry-run', execution)
  return deterministicPlanFromRun(provider, options, run, execution, 'full')
}

async function deterministicPlanFromRun(
  provider: TrustedConfigProvider,
  options: ResolvedMcpServerOptions,
  run: GenerationRun,
  execution: GenerationExecution,
  kind: 'full' | 'selective',
  selection?: SelectivePlanBinding,
): Promise<{ deterministic: DeterministicGenerationPlan; run: GenerationRun }> {
  if (!generationSucceeded(run)) throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'Generation failed while preparing the controlled write plan.')
  if (run.servers.length !== 1 || run.targets.length !== 1) {
    throw new McpToolError('MCP_WRITE_SINGLE_TARGET_REQUIRED', 'Controlled write currently requires exactly one configured target and one output root per plan.')
  }
  const server = run.servers[0]
  const generationResult = server?.result.generationResult
  if (!server || !generationResult) throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'Generation did not produce a complete artifact plan.')
  const artifacts = server.materialized
  const totalBytes = artifacts.reduce((total, artifact) => total + artifact.content.byteLength, 0)
  if (artifacts.length > options.write.maxFiles) throw new McpToolError('MCP_WRITE_LIMIT_EXCEEDED', 'The generation plan exceeds the configured file-count limit.')
  if (totalBytes > options.write.maxBytes) throw new McpToolError('MCP_WRITE_LIMIT_EXCEEDED', 'The generation plan exceeds the configured total-byte limit.')
  const loadedConfig = await provider.get(execution.signal)
  const outputRoot = generationResult.manifest.outputRoot
  const workspace = await directorySnapshot(options.workspaceRoot, options.workspaceRoot)
  const deterministic: DeterministicGenerationPlan = {
    schemaVersion: 1,
    kind,
    generatorVersion: version,
    workspace,
    config: {
      path: loadedConfig.displayPath,
      semanticHash: hash(stableJSON(loadedConfig.config)),
      sources: await currentConfigSources(options.workspaceRoot, loadedConfig.sources),
    },
    target: run.targets[0] as string,
    remotePolicyHash: hash(stableJSON(options.remote ?? {})),
    sources: (server.result.compilation.references?.sourceSnapshots ?? [])
      .map((snapshot) => planSource(options.workspaceRoot, snapshot))
      .sort((left, right) => compareText(left.displayPath, right.displayPath) || compareText(left.sha256, right.sha256)),
    output: {
      root: server.outputRoot,
      identity: await directorySnapshot(outputRoot, options.workspaceRoot),
      ownershipManifest: await stableFileSnapshot(path.join(outputRoot, '.openapi-to-manifest.json')),
      files: await outputFileStates(outputRoot, generationResult.manifest),
      artifacts: planArtifacts(artifacts),
      manifest: generationResult.manifest,
    },
    ...(selection ? { selection } : {}),
  }
  return { deterministic, run }
}

export async function prepareGenerationWritePlan(
  provider: TrustedConfigProvider,
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  options: ResolvedMcpServerOptions,
  requested: string[] | undefined,
  execution: GenerationExecution = {},
): Promise<PreparedGenerationPlan> {
  const { deterministic, run } = await deterministicPlan(provider, options, requested, execution)
  const serialized = stableJSON(deterministic)
  const planHash = hashDeterministicGenerationPlan(deterministic)
  const outputRoot = run.servers[0]?.result.generationResult?.manifest.outputRoot
  if (!outputRoot) throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'Generation did not establish an output root.')
  const created = store.create({
    schemaVersion: 1,
    kind: 'full',
    planHash,
    workspaceHash: deterministic.workspace.realPathHash,
    target: deterministic.target,
    outputRoot,
    byteSize: Buffer.byteLength(serialized),
    deterministic,
  })
  return { stored: created.plan, token: created.token, run }
}

export async function prepareSelectiveGenerationWritePlan(
  provider: TrustedConfigProvider,
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  options: ResolvedMcpServerOptions,
  registry: TrustedTargetCatalogRegistry,
  requested: string[] | undefined,
  mutation: OperationSelectionMutation,
  execution: GenerationExecution = {},
): Promise<PreparedGenerationPlan & { selection: PreparedOperationSelection }> {
  const selection = await prepareOperationSelection(provider, options, registry, requested, mutation, execution.signal)
  const run = await executeSelectiveGeneration(
    provider,
    options,
    registry,
    [selection.target.name],
    { type: 'operations', operationKeys: selection.merge.desiredOperationKeys },
    execution,
    'prepare',
  )
  const projectionHash = run.projection?.projectionHash
  if (!projectionHash || !run.projection) {
    throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'Selective Prepare did not produce a complete projected compilation identity.')
  }
  const binding: SelectivePlanBinding = {
    selectionManifestVersion: OPERATION_SELECTION_MANIFEST_VERSION,
    selectionOwner: selection.selectionOwner,
    selectionFileIdentity: selection.selectionFileIdentity,
    previousSelectionExists: selection.previousSelectionExists,
    previousSelectionHash: selection.previousSelectionHash,
    requestedOperationKeys: selection.merge.requestedOperationKeys,
    newlyAddedOperationKeys: selection.merge.newlyAddedOperationKeys,
    alreadySelectedOperationKeys: selection.merge.alreadySelectedOperationKeys,
    desiredOperationKeys: selection.merge.desiredOperationKeys,
    desiredSelectionHash: selection.desiredSelectionHash,
    projectionHash,
    projection: run.projection.stats,
  }
  const { deterministic } = await deterministicPlanFromRun(provider, options, run, execution, 'selective', binding)
  const serialized = stableJSON(deterministic)
  const planHash = hashDeterministicGenerationPlan(deterministic)
  const outputRoot = run.servers[0]?.result.generationResult?.manifest.outputRoot
  if (!outputRoot) throw new McpToolError('MCP_TOOL_EXECUTION_FAILED', 'Selective generation did not establish an output root.')
  const created = store.create({
    schemaVersion: 1,
    kind: 'selective',
    planHash,
    workspaceHash: deterministic.workspace.realPathHash,
    target: deterministic.target,
    outputRoot,
    byteSize: Buffer.byteLength(serialized),
    deterministic,
  })
  return { stored: created.plan, token: created.token, run, selection }
}

export function assertGenerationPlanApplySupported(
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  input: { planId: string; token: string; approvedPlanHash: string },
): InternalGenerationWritePlan {
  const plan = store.verify(input.planId, input.token, input.approvedPlanHash)
  if (plan.kind === 'selective') {
    throw new McpToolError('SELECTIVE_APPLY_NOT_ENABLED', 'Selective generation plans are review-only in this release and cannot be applied.')
  }
  return plan
}

function stalePlanDiagnostic(prepared: DeterministicGenerationPlan, current: DeterministicGenerationPlan): McpToolError {
  if (stableJSON(prepared.workspace) !== stableJSON(current.workspace)) return new McpToolError('MCP_PLAN_WORKSPACE_CHANGED', 'The Workspace identity changed after Prepare; create a new plan.')
  if (stableJSON(prepared.config) !== stableJSON(current.config)) return new McpToolError('MCP_PLAN_CONFIG_CHANGED', 'The trusted configuration or one of its local sources changed after Prepare; create a new plan.')
  if (stableJSON(prepared.sources) !== stableJSON(current.sources)) {
    const rootChanged = stableJSON(prepared.sources.find(({ isRoot }) => isRoot)) !== stableJSON(current.sources.find(({ isRoot }) => isRoot))
    return new McpToolError(rootChanged ? 'MCP_PLAN_SOURCE_CHANGED' : 'MCP_PLAN_REFERENCE_CHANGED', 'An OpenAPI input or local reference changed after Prepare; create a new plan.')
  }
  if (stableJSON(prepared.output.identity) !== stableJSON(current.output.identity)) return new McpToolError('MCP_PLAN_OUTPUT_CHANGED', 'The output root identity changed after Prepare; create a new plan.')
  if (stableJSON(prepared.output.ownershipManifest) !== stableJSON(current.output.ownershipManifest)) return new McpToolError('MCP_PLAN_MANIFEST_CHANGED', 'The ownership manifest changed after Prepare; create a new plan.')
  if (stableJSON(prepared.output.files) !== stableJSON(current.output.files)) return new McpToolError('MCP_PLAN_FILE_CHANGED', 'A planned output file changed after Prepare; create a new plan.')
  return new McpToolError('MCP_PLAN_GENERATION_CHANGED', 'Regeneration no longer matches the prepared artifact hashes; create a new plan.')
}

async function revalidateLocalSources(workspaceRoot: string, snapshots: readonly PlanSourceSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    if (snapshot.uriKind !== 'local') continue
    const current = await stableFileSnapshot(path.resolve(workspaceRoot, ...snapshot.displayPath.split('/')))
    if (!current.exists || current.sha256 !== snapshot.sha256 || current.bytes !== snapshot.bytes || stableJSON(current.identity) !== stableJSON(snapshot.identity)) {
      throw new McpToolError(snapshot.isRoot ? 'MCP_PLAN_SOURCE_CHANGED' : 'MCP_PLAN_REFERENCE_CHANGED', 'An OpenAPI source or reference changed while Apply was validating the plan; prepare again.')
    }
  }
}

export async function applyGenerationWritePlan(
  provider: TrustedConfigProvider,
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  options: ResolvedMcpServerOptions,
  input: { planId: string; token: string; approvedPlanHash: string },
  logger: McpLogger,
  execution: GenerationExecution = {},
): Promise<AppliedGenerationPlan> {
  const located = assertGenerationPlanApplySupported(store, input)
  let lock: OutputWriteLock | undefined
  const started = performance.now()
  try {
    lock = await acquireOutputWriteLock(located.outputRoot, {
      signal: execution.signal,
      waitTimeoutMs: options.write.lockWaitMs,
    })
    const plan = store.consume(input.planId, input.token, input.approvedPlanHash)
    logger.info('generation_apply_started', { planId: plan.planId, planHashPrefix: plan.planHash.slice(0, 12), targetCount: 1 })
    const { deterministic: current, run } = await deterministicPlan(provider, options, [plan.target], { ...execution, outputWriteLock: lock })
    if (!plan.deterministic.output.identity.exists && lock.rootCreated) current.output.identity = plan.deterministic.output.identity
    const currentHash = hashDeterministicGenerationPlan(current)
    if (currentHash !== plan.planHash) throw stalePlanDiagnostic(plan.deterministic, current)
    await revalidateLocalSources(options.workspaceRoot, current.sources)
    const refreshedConfig = await provider.get(execution.signal)
    if (stableJSON(await currentConfigSources(options.workspaceRoot, refreshedConfig.sources)) !== stableJSON(current.config.sources)) {
      throw new McpToolError('MCP_PLAN_CONFIG_CHANGED', 'The trusted configuration changed while Apply was validating the plan; prepare again.')
    }
    const server = run.servers[0]
    const generationResult = server?.result.generationResult
    if (!server || !generationResult) throw new McpToolError('MCP_PLAN_GENERATION_CHANGED', 'Apply regeneration did not produce the prepared artifacts.')
    const transaction = await commitOutputTransaction(lock, server.materialized, generationResult.manifest, {
      signal: execution.signal,
      expectedOwnershipManifest: current.output.ownershipManifest,
      generatorVersion: version,
      commitTimeoutMs: options.write.commitTimeoutMs,
      onPhase: async (phase) => {
        if (phase === 'committing') logger.info('generation_apply_committing', { planId: plan.planId, planHashPrefix: plan.planHash.slice(0, 12) })
        await execution.progress?.(phase === 'committing' ? 'Committing transaction' : phase === 'committed' ? 'Transaction committed' : 'Staging transaction', phase === 'committing' ? 90 : phase === 'committed' ? 98 : 80)
      },
    })
    const changedFiles = generationResult.manifest.entries
      .filter((entry): entry is typeof entry & { status: 'added' | 'modified' } => entry.status === 'added' || entry.status === 'modified')
      .map(({ path: changedPath, status }) => ({ path: changedPath, status }))
    const deletedFiles = generationResult.manifest.entries.filter(({ status }) => status === 'deleted').map(({ path: deletedPath }) => deletedPath)
    logger.info('generation_apply_succeeded', {
      planId: plan.planId,
      planHashPrefix: plan.planHash.slice(0, 12),
      added: transaction.added,
      modified: transaction.modified,
      deleted: transaction.deleted,
      bytes: transaction.bytes,
      stagingMs: transaction.stagingMs,
      commitMs: transaction.commitMs,
      durationMs: Math.round(performance.now() - started),
    })
    return {
      plan,
      transactionId: transaction.transactionId,
      summary: generationResult.manifest.summary,
      changedFiles,
      deletedFiles,
      rollbackPerformed: transaction.rollbackPerformed,
      cancelledDuringCommit: transaction.cancelledDuringCommit,
    }
  } catch (error) {
    const event = error instanceof McpToolError
      ? 'generation_plan_rejected'
      : error instanceof OutputRecoveryRequiredError || error instanceof OutputTransactionRollbackError
        ? 'generation_recovery_required'
        : error instanceof OutputTransactionRolledBackError
          ? 'generation_apply_rolled_back'
          : 'generation_apply_failed'
    logger.warn(event, {
      planId: input.planId,
      durationMs: Math.round(performance.now() - started),
      rollback: error instanceof OutputTransactionRolledBackError || (error instanceof Error && error.name === 'OutputTransactionRollbackError'),
      rollbackMs: error instanceof OutputTransactionRolledBackError ? error.rollbackMs : undefined,
    })
    throw error
  } finally {
    await lock?.release({ removeEmptyRoot: true })
  }
}
