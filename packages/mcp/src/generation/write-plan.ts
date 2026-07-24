import { createHash } from 'node:crypto'
import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

import {
  acquireOutputWriteLock,
  commitGenerationStateTransaction,
  commitOutputTransaction,
  DEFAULT_MAX_SELECTION_BYTES,
  hashOperationSelection,
  OPERATION_SELECTION_MANIFEST_VERSION,
  parseOperationSelectionManifest,
  serializeGenerationOwnershipManifest,
  serializeOperationSelectionManifest,
  snapshotOutputFile,
  type ConfigSourceSnapshot,
  type FileIdentity,
  type GenerationManifest,
  type MaterializedArtifact,
  type OutputFileSnapshot,
  type OutputTransactionOptions,
  type OutputWriteLock,
  OutputRecoveryRequiredError,
  OutputTransactionRollbackError,
  OutputTransactionRolledBackError,
  type SourceSnapshot,
  type OperationSelectionMutation,
  type OpenAPIProjectionStats,
  type TransactionRecoveryContext,
  type TransactionStateFile,
} from '@openapi-to/core'

import { version } from '../../package.json'
import { McpToolError } from '../errors.ts'
import type { McpLogger } from '../logger.ts'
import type { ResolvedMcpServerOptions } from '../options.ts'
import { workspaceRelative } from '../security/workspace.ts'
import type { TrustedTargetCatalogRegistry } from '../catalog/trusted-target-registry.ts'
import { executeGeneration, executeSelectiveGeneration, generationSucceeded, type GenerationExecution, type GenerationRun } from './service.ts'
import type { GenerationPlanStore, StoredGenerationPlan } from './plan-store.ts'
import {
  OPERATION_SELECTION_DIRECTORY,
  prepareOperationSelection,
  revalidateOperationSelectionState,
  type PreparedOperationSelection,
} from './selection-state.ts'
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
  order: number
  path: string
  kind: string
  sha256: string
  bytes: number
}

interface SelectivePlanBinding {
  selectionManifestVersion: typeof OPERATION_SELECTION_MANIFEST_VERSION
  selectionOwner: string
  selectionFileIdentity: string
  selectionFileSnapshot: OutputFileSnapshot
  previousSelectionExists: boolean
  previousSelectionHash: string
  requestedOperationKeys: string[]
  newlyAddedOperationKeys: string[]
  alreadySelectedOperationKeys: string[]
  desiredOperationKeys: string[]
  desiredSelectionHash: string
  desiredSelectionBytesSha256: string
  desiredSelectionBytes: number
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
    desiredOwnershipManifest: OutputFileSnapshot
  }
  selection?: SelectivePlanBinding
}

export interface InternalGenerationWritePlan extends StoredGenerationPlan {
  kind: 'full' | 'selective'
  deterministic: DeterministicGenerationPlan
  selectiveState?: {
    desiredSelectionBytes: string
  }
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
  selectionApplied: boolean
  selectedOperationCount?: number
  selectionHash?: string
  projectionHash?: string
  transactionMetrics: {
    stagingMs: number
    commitMs: number
    stagedBytes: number
    backupBytes: number
    journalBytes: number
  }
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
    .map((artifact, order) => ({ order, path: artifact.relativePath, kind: artifact.kind, sha256: artifact.hash, bytes: artifact.content.byteLength }))
    .sort((left, right) => compareText(left.path, right.path))
}

function desiredOwnershipManifest(artifacts: readonly MaterializedArtifact[]): OutputFileSnapshot {
  const bytes = serializeGenerationOwnershipManifest(artifacts, version)
  return bytes ? { exists: true, sha256: hash(bytes), bytes: bytes.byteLength } : { exists: false }
}

function authorizationContextHash(deterministic: DeterministicGenerationPlan): string {
  return hash(stableJSON({
    kind: deterministic.kind,
    target: deterministic.target,
    workspace: deterministic.workspace,
    outputRoot: deterministic.output.root,
    outputIdentity: deterministic.output.identity,
    selectionOwner: deterministic.selection?.selectionOwner,
  }))
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
    remotePolicyHash: server.remotePolicyHash,
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
      desiredOwnershipManifest: desiredOwnershipManifest(artifacts),
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
    authorizationContextHash: authorizationContextHash(deterministic),
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
    selectionFileSnapshot: {
      exists: selection.selectionFileSnapshot.exists,
      ...(selection.selectionFileSnapshot.sha256 ? { sha256: selection.selectionFileSnapshot.sha256 } : {}),
      ...(selection.selectionFileSnapshot.bytes === undefined ? {} : { bytes: selection.selectionFileSnapshot.bytes }),
      ...(selection.selectionFileSnapshot.identity ? { identity: selection.selectionFileSnapshot.identity } : {}),
    },
    previousSelectionExists: selection.previousSelectionExists,
    previousSelectionHash: selection.previousSelectionHash,
    requestedOperationKeys: selection.merge.requestedOperationKeys,
    newlyAddedOperationKeys: selection.merge.newlyAddedOperationKeys,
    alreadySelectedOperationKeys: selection.merge.alreadySelectedOperationKeys,
    desiredOperationKeys: selection.merge.desiredOperationKeys,
    desiredSelectionHash: selection.desiredSelectionHash,
    desiredSelectionBytesSha256: hash(selection.desiredSelectionBytes),
    desiredSelectionBytes: Buffer.byteLength(selection.desiredSelectionBytes),
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
    authorizationContextHash: authorizationContextHash(deterministic),
    workspaceHash: deterministic.workspace.realPathHash,
    target: deterministic.target,
    outputRoot,
    byteSize: Buffer.byteLength(serialized) + Buffer.byteLength(selection.desiredSelectionBytes),
    deterministic,
    selectiveState: { desiredSelectionBytes: selection.desiredSelectionBytes },
  })
  return { stored: created.plan, token: created.token, run, selection }
}

export function assertGenerationPlanApplySupported(
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  input: { planId: string; token: string; approvedPlanHash: string },
): InternalGenerationWritePlan {
  return store.verify(input.planId, input.token, input.approvedPlanHash)
}

function stalePlanDiagnostic(prepared: DeterministicGenerationPlan, current: DeterministicGenerationPlan): McpToolError {
  if (stableJSON(prepared.workspace) !== stableJSON(current.workspace)) return new McpToolError('MCP_PLAN_WORKSPACE_CHANGED', 'The Workspace identity changed after Prepare; create a new plan.')
  if (stableJSON(prepared.config) !== stableJSON(current.config)) return new McpToolError('MCP_PLAN_CONFIG_CHANGED', 'The trusted configuration or one of its local sources changed after Prepare; create a new plan.')
  if (stableJSON(prepared.sources) !== stableJSON(current.sources)) {
    const rootChanged = stableJSON(prepared.sources.find(({ isRoot }) => isRoot)) !== stableJSON(current.sources.find(({ isRoot }) => isRoot))
    return new McpToolError(rootChanged ? 'MCP_PLAN_SOURCE_CHANGED' : 'MCP_PLAN_REFERENCE_CHANGED', 'An OpenAPI input or local reference changed after Prepare; create a new plan.')
  }
  if (stableJSON(prepared.output.identity) !== stableJSON(current.output.identity)) return new McpToolError(prepared.kind === 'selective' ? 'SELECTIVE_APPLY_OUTPUT_DRIFT' : 'MCP_PLAN_OUTPUT_CHANGED', 'The output root identity changed after Prepare; create a new plan.')
  if (stableJSON(prepared.output.ownershipManifest) !== stableJSON(current.output.ownershipManifest)) return new McpToolError(prepared.kind === 'selective' ? 'SELECTIVE_APPLY_OWNERSHIP_MISMATCH' : 'MCP_PLAN_MANIFEST_CHANGED', 'The ownership manifest changed after Prepare; create a new plan.')
  if (stableJSON(prepared.output.files) !== stableJSON(current.output.files)) return new McpToolError(prepared.kind === 'selective' ? 'SELECTIVE_APPLY_OUTPUT_DRIFT' : 'MCP_PLAN_FILE_CHANGED', 'A planned output file changed after Prepare; create a new plan.')
  if (prepared.kind === 'selective' && stableJSON(prepared.output.artifacts) !== stableJSON(current.output.artifacts)) {
    return new McpToolError('SELECTIVE_APPLY_ARTIFACT_MISMATCH', 'Regeneration no longer matches the approved artifact paths, kinds, order, hashes, or bytes; create a new plan.')
  }
  if (prepared.kind === 'selective' && stableJSON(prepared.output.desiredOwnershipManifest) !== stableJSON(current.output.desiredOwnershipManifest)) {
    return new McpToolError('SELECTIVE_APPLY_OWNERSHIP_MISMATCH', 'Regeneration produced different ownership manifest bytes; create a new plan.')
  }
  return new McpToolError(prepared.kind === 'selective' ? 'SELECTIVE_APPLY_ARTIFACT_MISMATCH' : 'MCP_PLAN_GENERATION_CHANGED', 'Regeneration no longer matches the prepared artifact paths, kinds, order, hashes, or bytes; create a new plan.')
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

function transactionRecoveryContext(options: ResolvedMcpServerOptions): TransactionRecoveryContext {
  return { workspaceRoot: options.workspaceRoot, allowedStateRoots: [OPERATION_SELECTION_DIRECTORY] }
}

function selectiveBinding(plan: InternalGenerationWritePlan): SelectivePlanBinding {
  const binding = plan.deterministic.selection
  if (plan.kind !== 'selective' || !binding || !plan.selectiveState) {
    throw new McpToolError('SELECTIVE_APPLY_STATE_TRANSACTION_FAILED', 'The selective plan is missing its frozen selection state; prepare a new plan.')
  }
  return binding
}

function frozenSelectionBytes(plan: InternalGenerationWritePlan): Uint8Array {
  const binding = selectiveBinding(plan)
  const serialized = plan.selectiveState?.desiredSelectionBytes
  if (serialized === undefined) throw new McpToolError('SELECTIVE_APPLY_STATE_TRANSACTION_FAILED', 'The selective plan has no frozen selection bytes; prepare a new plan.')
  const bytes = new TextEncoder().encode(serialized)
  if (bytes.byteLength !== binding.desiredSelectionBytes || hash(bytes) !== binding.desiredSelectionBytesSha256) {
    throw new McpToolError('SELECTIVE_APPLY_STATE_TRANSACTION_FAILED', 'The frozen selection bytes no longer match the approved plan.')
  }
  const parsed = parseOperationSelectionManifest(bytes, {
    expectedTarget: plan.target,
    expectedSelectionOwner: binding.selectionOwner,
    maxBytes: DEFAULT_MAX_SELECTION_BYTES,
  })
  const firstError = parsed.diagnostics.find(({ severity }) => severity === 'error')
  if (!parsed.manifest || firstError) {
    throw new McpToolError('SELECTIVE_APPLY_STATE_TRANSACTION_FAILED', 'The frozen selection manifest is no longer valid for the approved target and owner.')
  }
  if (
    parsed.manifest.version !== binding.selectionManifestVersion
    || stableJSON(parsed.manifest.operations) !== stableJSON(binding.desiredOperationKeys)
    || hashOperationSelection(parsed.manifest) !== binding.desiredSelectionHash
    || serializeOperationSelectionManifest(parsed.manifest) !== serialized
  ) {
    throw new McpToolError('SELECTIVE_APPLY_STATE_TRANSACTION_FAILED', 'The frozen selection manifest does not reproduce the approved semantic and byte identity.')
  }
  return bytes
}

async function revalidateSelectiveSelection(options: ResolvedMcpServerOptions, plan: InternalGenerationWritePlan): Promise<TransactionStateFile> {
  const binding = selectiveBinding(plan)
  await revalidateOperationSelectionState(options, {
    target: plan.target,
    selectionOwner: binding.selectionOwner,
    selectionFileIdentity: binding.selectionFileIdentity,
    selectionFileSnapshot: binding.selectionFileSnapshot,
    previousSelectionHash: binding.previousSelectionHash,
  })
  const desiredBytes = frozenSelectionBytes(plan)
  return {
    id: 'operation-selection',
    workspaceRelativePath: binding.selectionFileIdentity,
    expectedBefore: binding.selectionFileSnapshot,
    desiredBytes,
    desiredSha256: binding.desiredSelectionBytesSha256,
    maxBytes: DEFAULT_MAX_SELECTION_BYTES,
  }
}

function assertSelectiveProjection(plan: InternalGenerationWritePlan, run: GenerationRun): void {
  const binding = selectiveBinding(plan)
  if (
    run.projection?.projectionHash !== binding.projectionHash
    || stableJSON(run.projection?.stats) !== stableJSON(binding.projection)
    || stableJSON(run.selection?.resolvedOperationKeys) !== stableJSON(binding.desiredOperationKeys)
  ) {
    throw new McpToolError('SELECTIVE_APPLY_PROJECTION_MISMATCH', 'The current projected compilation does not match the approved selective plan; prepare a new plan.')
  }
}

export async function applyGenerationWritePlan(
  provider: TrustedConfigProvider,
  store: GenerationPlanStore<InternalGenerationWritePlan>,
  options: ResolvedMcpServerOptions,
  registry: TrustedTargetCatalogRegistry,
  input: { planId: string; token: string; approvedPlanHash: string },
  logger: McpLogger,
  execution: GenerationExecution = {},
): Promise<AppliedGenerationPlan> {
  const located = assertGenerationPlanApplySupported(store, input)
  const recoveryContext = transactionRecoveryContext(options)
  let lock: OutputWriteLock | undefined
  const started = performance.now()
  try {
    await revalidateLocalSources(options.workspaceRoot, located.deterministic.sources)
    const beforeLockConfig = await provider.get(execution.signal)
    if (stableJSON(await currentConfigSources(options.workspaceRoot, beforeLockConfig.sources)) !== stableJSON(located.deterministic.config.sources)) {
      throw new McpToolError('MCP_PLAN_CONFIG_CHANGED', 'The trusted configuration changed after Prepare; prepare again.')
    }
    if (located.kind === 'selective') await revalidateSelectiveSelection(options, located)
    lock = await acquireOutputWriteLock(located.outputRoot, {
      signal: execution.signal,
      waitTimeoutMs: options.write.lockWaitMs,
      recoveryContext,
    })
    const plan = store.consume(input.planId, input.token, input.approvedPlanHash)
    logger.info('generation_apply_started', { planId: plan.planId, planHashPrefix: plan.planHash.slice(0, 12), targetCount: 1, planKind: plan.kind })
    const regenerated = plan.kind === 'selective'
      ? await executeSelectiveGeneration(
          provider,
          options,
          registry,
          [plan.target],
          { type: 'operations', operationKeys: selectiveBinding(plan).desiredOperationKeys },
          { ...execution, outputWriteLock: lock },
          'apply',
        ).then(async (run) => {
          assertSelectiveProjection(plan, run)
          return deterministicPlanFromRun(provider, options, run, execution, 'selective', selectiveBinding(plan))
        })
      : await deterministicPlan(provider, options, [plan.target], { ...execution, outputWriteLock: lock })
    const { deterministic: current, run } = regenerated
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
    const stateFiles = plan.kind === 'selective' ? [await revalidateSelectiveSelection(options, plan)] : []
    const transactionOptions: OutputTransactionOptions = {
      signal: execution.signal,
      expectedOwnershipManifest: current.output.ownershipManifest,
      recoveryContext,
      generatorVersion: version,
      commitTimeoutMs: options.write.commitTimeoutMs,
      ...(execution.transactionFailpoint ? { testFailpoint: execution.transactionFailpoint } : {}),
      onPhase: async (phase) => {
        if (phase === 'committing') logger.info('generation_apply_committing', { planId: plan.planId, planHashPrefix: plan.planHash.slice(0, 12) })
        await execution.progress?.(phase === 'committing' ? 'Committing transaction' : phase === 'committed' ? 'Transaction committed' : 'Staging transaction', phase === 'committing' ? 90 : phase === 'committed' ? 98 : 80)
      },
    }
    const transaction = plan.kind === 'selective'
      ? await commitGenerationStateTransaction(lock, server.materialized, generationResult.manifest, stateFiles, transactionOptions)
      : await commitOutputTransaction(lock, server.materialized, generationResult.manifest, transactionOptions)
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
      selectionApplied: plan.kind === 'selective',
      transactionMetrics: {
        stagingMs: transaction.stagingMs,
        commitMs: transaction.commitMs,
        stagedBytes: transaction.stagedBytes,
        backupBytes: transaction.backupBytes,
        journalBytes: transaction.journalBytes,
      },
      ...(plan.deterministic.selection
        ? {
            selectedOperationCount: plan.deterministic.selection.desiredOperationKeys.length,
            selectionHash: plan.deterministic.selection.desiredSelectionHash,
            projectionHash: plan.deterministic.selection.projectionHash,
          }
        : {}),
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
