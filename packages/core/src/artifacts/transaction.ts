import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, rmdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { throwIfAborted } from '../execution.ts'
import type { GenerationManifest, MaterializedArtifact } from './types.ts'

export const ARTIFACT_MANIFEST_FILENAME = '.openapi-to-manifest.json'
export const OUTPUT_WRITE_LOCK_DIRECTORY = '.openapi-to-write.lock'
export const OUTPUT_TRANSACTION_DIRECTORY = '.openapi-to-transaction'
export const OUTPUT_TRANSACTION_JOURNAL = '.openapi-to-transaction.json'
export const STATE_TRANSACTION_DIRECTORY = '.openapi-to-state-transaction'
export const DEFAULT_MAX_TRANSACTION_STATE_FILES = 16
export const DEFAULT_MAX_TRANSACTION_STATE_FILE_BYTES = 1024 * 1024
export const DEFAULT_MAX_TRANSACTION_STATE_TOTAL_BYTES = 4 * 1024 * 1024

const RESERVED_OUTPUT_NAMES = new Set([
  ARTIFACT_MANIFEST_FILENAME,
  OUTPUT_WRITE_LOCK_DIRECTORY,
  OUTPUT_TRANSACTION_DIRECTORY,
  OUTPUT_TRANSACTION_JOURNAL,
  `${OUTPUT_TRANSACTION_JOURNAL}.tmp`,
])
const lockBrand = Symbol('openapi-to-output-write-lock')
const encoder = new TextEncoder()

export type TransactionFailpoint =
  | 'staging-first'
  | 'staging-middle'
  | 'staging-complete'
  | 'backup-first'
  | 'rename-first'
  | 'rename-middle'
  | 'delete-first'
  | 'manifest-temp'
  | 'manifest-backup'
  | 'manifest-rename'
  | 'state-stage'
  | 'state-after-stage'
  | 'state-backup'
  | 'state-after-backup'
  | 'state-rename'
  | 'state-after-rename'
  | 'state-verify'
  | 'state-cleanup'
  | 'cleanup'

export interface FileIdentity {
  device: string
  inode: string
  size: string
  modifiedNanoseconds: string
}

export interface OutputFileSnapshot {
  exists: boolean
  sha256?: string
  bytes?: number
  identity?: FileIdentity
}

export interface OutputWriteLockOptions {
  signal?: AbortSignal
  waitTimeoutMs?: number
  pollIntervalMs?: number
  staleLockMs?: number
  recoveryContext?: TransactionRecoveryContext
}

export interface TransactionRecoveryContext {
  workspaceRoot: string
  /** Workspace-relative directories that may contain controlled state files. */
  allowedStateRoots: string[]
}

export interface TransactionStateFile {
  id: string
  /** A normalized POSIX path relative to recoveryContext.workspaceRoot. */
  workspaceRelativePath: string
  expectedBefore: OutputFileSnapshot
  desiredBytes: Uint8Array
  desiredSha256: string
  maxBytes: number
}

export interface OutputTransactionOptions {
  signal?: AbortSignal
  lock?: OutputWriteLock
  expectedOwnershipManifest?: OutputFileSnapshot
  recoveryContext?: TransactionRecoveryContext
  generatorVersion?: string
  commitTimeoutMs?: number
  /** @internal Fault injection used only by transaction tests. */
  testFailpoint?: TransactionFailpoint
  /** @internal Terminates the current test subprocess at a failpoint to exercise recovery. */
  testCrashAt?: TransactionFailpoint
  onPhase?: (phase: string) => void | Promise<void>
}

export interface OutputTransactionResult {
  transactionId: string
  added: number
  modified: number
  deleted: number
  bytes: number
  rollbackPerformed: boolean
  cancelledDuringCommit: boolean
  stagingMs: number
  commitMs: number
  stateFiles: number
  stateBytes: number
  stagedBytes: number
  backupBytes: number
  journalBytes: number
}

interface JournalOperation {
  index: number
  path: string
  status: 'added' | 'modified' | 'deleted'
  kind?: string
  before: OutputFileSnapshot
  after: OutputFileSnapshot
}

type TransactionPhase = 'staging' | 'backup' | 'committing' | 'committed'

interface TransactionJournalPayloadV1 {
  schemaVersion: 1
  transactionId: string
  outputRootHash: string
  phase: TransactionPhase
  operations: JournalOperation[]
  manifestBefore: OutputFileSnapshot
  manifestAfter: OutputFileSnapshot
  createdDirectories: string[]
}

interface JournalStateOperation {
  index: number
  id: string
  workspaceRelativePath: string
  before: OutputFileSnapshot
  after: OutputFileSnapshot
  stageRelativePath: string
  backupRelativePath: string
}

interface TransactionJournalPayloadV2 {
  schemaVersion: 2
  transactionId: string
  outputRootHash: string
  workspaceRootHash: string
  phase: TransactionPhase
  operations: JournalOperation[]
  manifestBefore: OutputFileSnapshot
  manifestAfter: OutputFileSnapshot
  createdDirectories: string[]
  stateOperations: JournalStateOperation[]
  stateCreatedDirectories: string[]
}

type TransactionJournalPayload = TransactionJournalPayloadV1 | TransactionJournalPayloadV2

type TransactionJournal = TransactionJournalPayload & {
  checksum: string
}

export type TransactionStateErrorCode =
  | 'TRANSACTION_STATE_FILE_INVALID'
  | 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE'
  | 'TRANSACTION_STATE_FILE_SYMLINK'
  | 'TRANSACTION_STATE_FILE_TOO_LARGE'
  | 'TRANSACTION_STATE_SNAPSHOT_MISMATCH'
  | 'TRANSACTION_STATE_STAGE_FAILED'
  | 'TRANSACTION_STATE_BACKUP_FAILED'
  | 'TRANSACTION_STATE_COMMIT_FAILED'
  | 'TRANSACTION_STATE_VERIFY_FAILED'
  | 'TRANSACTION_STATE_RECOVERY_FAILED'
  | 'TRANSACTION_JOURNAL_VERSION_UNSUPPORTED'
  | 'TRANSACTION_RECOVERY_CONTEXT_REQUIRED'
  | 'SELECTIVE_STATE_CROSS_DEVICE_UNSUPPORTED'

export class OutputWriteLockedError extends Error {
  constructor() {
    super('The output root is locked by another writer.')
    this.name = 'OutputWriteLockedError'
  }
}

export class OutputRecoveryRequiredError extends Error {
  constructor(message = 'An incomplete output transaction requires safe recovery.') {
    super(message)
    this.name = 'OutputRecoveryRequiredError'
  }
}

export class TransactionStateFileError extends OutputRecoveryRequiredError {
  constructor(
    readonly code: TransactionStateErrorCode,
    readonly stateFileId?: string,
    readonly workspaceRelativePath?: string,
    message = 'A controlled transaction state file failed validation.',
  ) {
    super(message)
    this.name = 'TransactionStateFileError'
  }
}

export class OutputPreconditionChangedError extends Error {
  constructor(readonly relativePath: string) {
    super('An output transaction precondition changed.')
    this.name = 'OutputPreconditionChangedError'
  }
}

export class OutputTransactionRollbackError extends Error {
  constructor(readonly originalError: unknown, readonly rollbackError: unknown, readonly rollbackMs?: number) {
    super('The output transaction failed and could not be completely rolled back.')
    this.name = 'OutputTransactionRollbackError'
  }
}

export class OutputTransactionRolledBackError extends Error {
  constructor(readonly originalError: unknown, readonly rollbackMs: number) {
    super('The output transaction failed after commit began and was rolled back completely.')
    this.name = 'OutputTransactionRolledBackError'
  }
}

export class OutputCommitTimeoutError extends Error {
  constructor() {
    super('The output transaction commit deadline expired and rollback was attempted.')
    this.name = 'OutputCommitTimeoutError'
  }
}

export class OutputWriteLock {
  readonly [lockBrand] = true
  private released = false

  constructor(
    readonly outputRoot: string,
    readonly lockPath: string,
    readonly nonce: string,
    readonly rootCreated: boolean,
    private readonly rootIdentity: { device: string; inode: string },
    private readonly lockIdentity: { device: string; inode: string },
  ) {}

  assertActive(outputRoot: string): void {
    if (this.released || path.resolve(outputRoot) !== this.outputRoot) throw new Error('The output write lock is not active for this output root.')
  }

  async assertStable(): Promise<void> {
    this.assertActive(this.outputRoot)
    try {
      const [root, lock] = await Promise.all([lstat(this.outputRoot, { bigint: true }), lstat(this.lockPath, { bigint: true })])
      if (
        !root.isDirectory() || root.isSymbolicLink() || root.dev.toString() !== this.rootIdentity.device || root.ino.toString() !== this.rootIdentity.inode
        || !lock.isDirectory() || lock.isSymbolicLink() || lock.dev.toString() !== this.lockIdentity.device || lock.ino.toString() !== this.lockIdentity.inode
      ) {
        throw new OutputRecoveryRequiredError('The output root or write lock identity changed during the transaction.')
      }
    } catch (error) {
      if (error instanceof OutputRecoveryRequiredError) throw error
      throw new OutputRecoveryRequiredError('The output root or write lock identity changed during the transaction.')
    }
  }

  async release(options: { removeEmptyRoot?: boolean } = {}): Promise<void> {
    if (this.released) return
    this.released = true
    const ownerPath = path.join(this.lockPath, 'owner.json')
    try {
      const owner = JSON.parse(await readFile(ownerPath, 'utf8')) as { nonce?: unknown }
      if (owner.nonce !== this.nonce) throw new OutputRecoveryRequiredError('The output write lock owner changed unexpectedly.')
      await unlink(ownerPath)
      await rmdir(this.lockPath)
      if (options.removeEmptyRoot && this.rootCreated) await rmdir(this.outputRoot).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => compareText(left, right)).map(([key, item]) => [key, stableValue(item)]))
}

function stableJSON(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

function journalChecksum(payload: TransactionJournalPayload): string {
  return createHash('sha256').update(stableJSON(payload)).digest('hex')
}

function withChecksum(payload: TransactionJournalPayload): TransactionJournal {
  return { ...payload, checksum: journalChecksum(payload) }
}

function safeRelativePath(outputRoot: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\')) throw new OutputRecoveryRequiredError('Transaction contains an unsafe output path.')
  const normalized = path.posix.normalize(relativePath)
  if (normalized !== relativePath || normalized === '..' || normalized.startsWith('../')) throw new OutputRecoveryRequiredError('Transaction contains an unsafe output path.')
  if (RESERVED_OUTPUT_NAMES.has(normalized.split('/')[0] ?? '')) throw new OutputRecoveryRequiredError('Transaction collides with a reserved output path.')
  const absolutePath = path.resolve(outputRoot, ...normalized.split('/'))
  const relative = path.relative(outputRoot, absolutePath)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new OutputRecoveryRequiredError('Transaction path escapes the output root.')
  return absolutePath
}

interface ResolvedRecoveryContext {
  workspaceRoot: string
  workspaceRootHash: string
  allowedStateRoots: string[]
}

interface PreparedStateOperation extends JournalStateOperation {
  desiredBytes: Uint8Array
  absolutePath: string
  stagePath: string
  backupPath: string
}

function normalizedWorkspaceRelativePath(
  relativePath: string,
  code: TransactionStateErrorCode = 'TRANSACTION_STATE_FILE_INVALID',
  allowTransactionStorage = false,
): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new TransactionStateFileError(code, undefined, undefined, 'A controlled state path must be Workspace-relative.')
  }
  const normalized = path.posix.normalize(relativePath)
  if (normalized.length > 512 || normalized !== relativePath || normalized === '..' || normalized.startsWith('../')) {
    throw new TransactionStateFileError(code, undefined, undefined, 'A controlled state path escapes its trusted Workspace.')
  }
  if (!allowTransactionStorage && normalized.split('/').includes(STATE_TRANSACTION_DIRECTORY)) {
    throw new TransactionStateFileError(code, undefined, normalized, 'A controlled state path collides with transaction-owned storage.')
  }
  return normalized
}

function validFileIdentity(identity: FileIdentity | undefined): boolean {
  return identity !== undefined
    && /^\d+$/.test(identity.device)
    && /^\d+$/.test(identity.inode)
    && /^\d+$/.test(identity.size)
    && /^\d+$/.test(identity.modifiedNanoseconds)
}

function validStateSnapshot(snapshot: OutputFileSnapshot, requireIdentity: boolean): boolean {
  if (typeof snapshot?.exists !== 'boolean') return false
  if (!snapshot.exists) return snapshot.sha256 === undefined && snapshot.bytes === undefined && snapshot.identity === undefined
  return /^[a-f0-9]{64}$/.test(snapshot.sha256 ?? '')
    && Number.isSafeInteger(snapshot.bytes)
    && (snapshot.bytes ?? -1) >= 0
    && (snapshot.bytes ?? Number.POSITIVE_INFINITY) <= DEFAULT_MAX_TRANSACTION_STATE_FILE_BYTES
    && (snapshot.identity === undefined || validFileIdentity(snapshot.identity))
    && (!requireIdentity || validFileIdentity(snapshot.identity))
}

async function resolveRecoveryContext(context: TransactionRecoveryContext | undefined): Promise<ResolvedRecoveryContext> {
  if (!context) {
    throw new TransactionStateFileError(
      'TRANSACTION_RECOVERY_CONTEXT_REQUIRED',
      undefined,
      undefined,
      'Journal v2 recovery requires a trusted Workspace and controlled state roots.',
    )
  }
  if (context.allowedStateRoots.length === 0 || context.allowedStateRoots.length > DEFAULT_MAX_TRANSACTION_STATE_FILES) {
    throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', undefined, undefined, 'Controlled state roots are missing or exceed the supported limit.')
  }
  const workspaceRoot = path.resolve(context.workspaceRoot)
  const workspaceMetadata = await lstat(workspaceRoot)
  if (!workspaceMetadata.isDirectory() || workspaceMetadata.isSymbolicLink()) {
    throw new TransactionStateFileError('TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', undefined, undefined, 'The trusted Workspace is not a real directory.')
  }
  const canonicalWorkspace = await realpath(workspaceRoot)
  const allowedStateRoots = context.allowedStateRoots.map((candidate) => {
    const relative = normalizedWorkspaceRelativePath(candidate, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE')
    if (relative === '.') {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', undefined, relative, 'The trusted Workspace root cannot be used as a controlled state root.')
    }
    const absolute = path.resolve(workspaceRoot, ...relative.split('/'))
    const fromWorkspace = path.relative(workspaceRoot, absolute)
    if (fromWorkspace === '..' || fromWorkspace.startsWith(`..${path.sep}`) || path.isAbsolute(fromWorkspace)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', undefined, relative, 'A controlled state root escapes the trusted Workspace.')
    }
    return absolute
  }).sort(compareText)
  return {
    workspaceRoot,
    workspaceRootHash: createHash('sha256').update(canonicalWorkspace).digest('hex'),
    allowedStateRoots,
  }
}

function resolveStatePath(context: ResolvedRecoveryContext, relativePath: string, id?: string, allowTransactionStorage = false): string {
  let normalized: string
  try {
    normalized = normalizedWorkspaceRelativePath(relativePath, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', allowTransactionStorage)
  } catch (error) {
    if (error instanceof TransactionStateFileError) {
      throw new TransactionStateFileError(error.code, id, error.workspaceRelativePath, error.message)
    }
    throw error
  }
  const absolute = path.resolve(context.workspaceRoot, ...normalized.split('/'))
  const allowed = context.allowedStateRoots.some((root) => {
    const relative = path.relative(root, absolute)
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  })
  if (!allowed) {
    throw new TransactionStateFileError(
      'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE',
      id,
      normalized,
      'A controlled state file is outside the trusted state roots.',
    )
  }
  return absolute
}

function resolveStateCreatedDirectory(context: ResolvedRecoveryContext, relativePath: string): string {
  const normalized = normalizedWorkspaceRelativePath(relativePath, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE')
  if (normalized === '.') {
    throw new TransactionStateFileError('TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', undefined, normalized, 'The trusted Workspace root cannot be removed during state recovery.')
  }
  const absolute = path.resolve(context.workspaceRoot, ...normalized.split('/'))
  const containsAllowedRoot = context.allowedStateRoots.some((root) => {
    const relative = path.relative(absolute, root)
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  })
  if (!containsAllowedRoot) {
    throw new TransactionStateFileError(
      'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE',
      undefined,
      normalized,
      'A controlled state directory is not an ancestor of a trusted state root.',
    )
  }
  return absolute
}

async function assertNoStateSymlinkSegments(context: ResolvedRecoveryContext, relativePath: string, id?: string): Promise<void> {
  let current = context.workspaceRoot
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) {
        throw new TransactionStateFileError(
          'TRANSACTION_STATE_FILE_SYMLINK',
          id,
          relativePath,
          'A controlled state path contains a symbolic link.',
        )
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
  }
}

async function nearestExistingDirectory(candidate: string): Promise<{ path: string; device: string }> {
  let current = path.resolve(candidate)
  for (;;) {
    try {
      const metadata = await lstat(current, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', undefined, undefined, 'A controlled state parent is not a real directory.')
      }
      return { path: current, device: metadata.dev.toString() }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const parent = path.dirname(current)
      if (parent === current) throw new TransactionStateFileError('TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE')
      current = parent
    }
  }
}

function stateSnapshotMatchesExpected(current: OutputFileSnapshot, expected: OutputFileSnapshot): boolean {
  if (!outputSnapshotsEqual(current, expected)) return false
  if (!expected.exists || !expected.identity) return true
  return current.identity?.device === expected.identity.device
    && current.identity.inode === expected.identity.inode
    && current.identity.size === expected.identity.size
    && current.identity.modifiedNanoseconds === expected.identity.modifiedNanoseconds
}

async function assertNoSymlinkSegments(outputRoot: string, relativePath: string): Promise<void> {
  let current = path.resolve(outputRoot)
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) throw new OutputRecoveryRequiredError('Transaction output path contains a symlink.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
  }
}

async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await open(directory, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
  }
}

async function writeSyncedFile(filePath: string, content: Uint8Array): Promise<void> {
  const handle = await open(filePath, 'w', 0o600)
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function writeJournal(outputRoot: string, payload: TransactionJournalPayload): Promise<void> {
  const journalPath = path.join(outputRoot, OUTPUT_TRANSACTION_JOURNAL)
  const temporaryPath = `${journalPath}.tmp`
  await writeSyncedFile(temporaryPath, encoder.encode(`${stableJSON(withChecksum(payload))}\n`))
  await rename(temporaryPath, journalPath)
  await syncDirectory(outputRoot)
}

async function readJournal(outputRoot: string): Promise<TransactionJournal | undefined> {
  const journalPath = path.join(outputRoot, OUTPUT_TRANSACTION_JOURNAL)
  try {
    const metadata = await lstat(journalPath)
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 1024 * 1024) throw new OutputRecoveryRequiredError('The transaction journal is unsafe or too large.')
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as TransactionJournal
    const { checksum, ...payload } = journal
    if (journal.schemaVersion !== 1 && journal.schemaVersion !== 2) {
      throw new TransactionStateFileError(
        'TRANSACTION_JOURNAL_VERSION_UNSUPPORTED',
        undefined,
        undefined,
        'The transaction journal version is not supported.',
      )
    }
    if (typeof checksum !== 'string' || checksum !== journalChecksum(payload)) {
      throw new OutputRecoveryRequiredError('The transaction journal failed its integrity check.')
    }
    if (
      !/^[0-9a-f-]{36}$/i.test(journal.transactionId)
      || !['staging', 'backup', 'committing', 'committed'].includes(journal.phase)
      || !Array.isArray(journal.operations)
      || !Array.isArray(journal.createdDirectories)
    ) {
      throw new OutputRecoveryRequiredError('The transaction journal has an invalid schema.')
    }
    for (const operation of journal.operations) safeRelativePath(outputRoot, operation.path)
    for (const directory of journal.createdDirectories) safeRelativePath(outputRoot, `${directory}/.directory-check`)
    if (journal.schemaVersion === 2) {
      if (
        typeof journal.workspaceRootHash !== 'string'
        || !Array.isArray(journal.stateOperations)
        || journal.stateOperations.length > DEFAULT_MAX_TRANSACTION_STATE_FILES
        || !Array.isArray(journal.stateCreatedDirectories)
      ) {
        throw new OutputRecoveryRequiredError('The transaction journal v2 state schema is invalid.')
      }
      for (const operation of journal.stateOperations) {
        if (
          !Number.isInteger(operation.index)
          || typeof operation.id !== 'string'
          || !/^[a-zA-Z0-9._-]{1,64}$/.test(operation.id)
          || typeof operation.workspaceRelativePath !== 'string'
          || typeof operation.stageRelativePath !== 'string'
          || typeof operation.backupRelativePath !== 'string'
          || !validStateSnapshot(operation.before, operation.before?.exists === true)
          || !validStateSnapshot(operation.after, false)
          || operation.after?.exists !== true
        ) {
          throw new OutputRecoveryRequiredError('The transaction journal v2 contains an invalid state operation.')
        }
        normalizedWorkspaceRelativePath(operation.workspaceRelativePath, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE')
        normalizedWorkspaceRelativePath(operation.stageRelativePath, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', true)
        normalizedWorkspaceRelativePath(operation.backupRelativePath, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE', true)
      }
      for (const directory of journal.stateCreatedDirectories) {
        normalizedWorkspaceRelativePath(directory, 'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE')
      }
    }
    return journal
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    if (error instanceof OutputRecoveryRequiredError) throw error
    throw new OutputRecoveryRequiredError('The transaction journal could not be read safely.')
  }
}

export async function snapshotOutputFile(filePath: string): Promise<OutputFileSnapshot> {
  try {
    const before = await lstat(filePath, { bigint: true })
    if (!before.isFile() || before.isSymbolicLink() || before.nlink > 1n) throw new OutputPreconditionChangedError(path.basename(filePath))
    const handle = await open(filePath, 'r')
    try {
      const opened = await handle.stat({ bigint: true })
      if (opened.dev !== before.dev || opened.ino !== before.ino) throw new OutputPreconditionChangedError(path.basename(filePath))
      const bytes = new Uint8Array(await handle.readFile())
      const after = await lstat(filePath, { bigint: true })
      if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs) {
        throw new OutputPreconditionChangedError(path.basename(filePath))
      }
      return {
        exists: true,
        sha256: hashBytes(bytes),
        bytes: bytes.byteLength,
        identity: {
          device: opened.dev.toString(),
          inode: opened.ino.toString(),
          size: opened.size.toString(),
          modifiedNanoseconds: opened.mtimeNs.toString(),
        },
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false }
    throw error
  }
}

export function outputSnapshotsEqual(left: OutputFileSnapshot, right: OutputFileSnapshot): boolean {
  return left.exists === right.exists && left.sha256 === right.sha256 && left.bytes === right.bytes
}

async function ensureRealOutputRoot(outputRoot: string): Promise<boolean> {
  const resolved = path.resolve(outputRoot)
  try {
    const metadata = await lstat(resolved)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new OutputRecoveryRequiredError('Output root must be a real directory.')
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(resolved, { recursive: true })
    const metadata = await lstat(resolved)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new OutputRecoveryRequiredError('Output root changed while the writer was starting.')
    return true
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function removeStaleLock(lockPath: string, staleLockMs: number): Promise<boolean> {
  const metadata = await lstat(lockPath)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new OutputRecoveryRequiredError('The output lock path is unsafe.')
  const ownerPath = path.join(lockPath, 'owner.json')
  try {
    const ownerMetadata = await lstat(ownerPath)
    if (!ownerMetadata.isFile() || ownerMetadata.isSymbolicLink() || ownerMetadata.size > 4096) throw new OutputRecoveryRequiredError('The output lock owner record is unsafe.')
    const owner = JSON.parse(await readFile(ownerPath, 'utf8')) as { pid?: unknown }
    if (typeof owner.pid !== 'number' || !Number.isInteger(owner.pid) || owner.pid <= 0) throw new OutputRecoveryRequiredError('The output lock owner record is invalid.')
    if (processIsAlive(owner.pid)) return false
    await unlink(ownerPath)
    await rmdir(lockPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (Date.now() - metadata.mtimeMs < staleLockMs) return false
    await rmdir(lockPath)
    return true
  }
}

export async function acquireOutputWriteLock(outputRoot: string, options: OutputWriteLockOptions = {}): Promise<OutputWriteLock> {
  throwIfAborted(options.signal)
  const root = path.resolve(outputRoot)
  const rootCreated = await ensureRealOutputRoot(root)
  const lockPath = path.join(root, OUTPUT_WRITE_LOCK_DIRECTORY)
  const nonce = randomUUID()
  const waitTimeoutMs = options.waitTimeoutMs ?? 30_000
  const pollIntervalMs = options.pollIntervalMs ?? 50
  const staleLockMs = options.staleLockMs ?? 5 * 60_000
  const deadline = Date.now() + waitTimeoutMs
  for (;;) {
    throwIfAborted(options.signal)
    try {
      await mkdir(lockPath, { mode: 0o700 })
      await writeSyncedFile(
        path.join(lockPath, 'owner.json'),
        encoder.encode(`${JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce })}\n`),
      )
      await syncDirectory(root)
      const [rootMetadata, lockMetadata] = await Promise.all([lstat(root, { bigint: true }), lstat(lockPath, { bigint: true })])
      const lock = new OutputWriteLock(
        root,
        lockPath,
        nonce,
        rootCreated,
        { device: rootMetadata.dev.toString(), inode: rootMetadata.ino.toString() },
        { device: lockMetadata.dev.toString(), inode: lockMetadata.ino.toString() },
      )
      try {
        await recoverOutputTransaction(lock, options.recoveryContext)
        return lock
      } catch (error) {
        await lock.release({ removeEmptyRoot: true }).catch(() => undefined)
        throw error
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await removeStaleLock(lockPath, staleLockMs)) continue
      if (Date.now() >= deadline) throw new OutputWriteLockedError()
      await delay(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())), undefined, { signal: options.signal })
    }
  }
}

export async function outputWriteInProgress(outputRoot: string, lock?: OutputWriteLock): Promise<boolean> {
  if (lock) {
    lock.assertActive(outputRoot)
    return false
  }
  for (const candidate of [OUTPUT_WRITE_LOCK_DIRECTORY, OUTPUT_TRANSACTION_JOURNAL]) {
    try {
      await lstat(path.join(path.resolve(outputRoot), candidate))
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return false
}

function transactionPath(outputRoot: string, transactionId: string, area: 'stage' | 'backup', index: number): string {
  return path.join(outputRoot, OUTPUT_TRANSACTION_DIRECTORY, transactionId, area, index.toString().padStart(6, '0'))
}

async function removeKnownTransactionFiles(outputRoot: string, journal: TransactionJournal): Promise<void> {
  const transactionRoot = path.join(outputRoot, OUTPUT_TRANSACTION_DIRECTORY, journal.transactionId)
  const metadata = await lstat(transactionRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
  if (metadata?.isSymbolicLink() || (metadata && !metadata.isDirectory())) throw new OutputRecoveryRequiredError('The transaction staging directory is unsafe.')
  for (const operation of journal.operations) {
    await unlink(transactionPath(outputRoot, journal.transactionId, 'stage', operation.index)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    await unlink(transactionPath(outputRoot, journal.transactionId, 'backup', operation.index)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
  await unlink(path.join(transactionRoot, 'stage', 'manifest')).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await unlink(path.join(transactionRoot, 'backup', 'manifest')).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  for (const area of ['stage', 'backup'] as const) await rmdir(path.join(transactionRoot, area)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await rmdir(transactionRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await rmdir(path.join(outputRoot, OUTPUT_TRANSACTION_DIRECTORY)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
  })
}

interface ResolvedJournalStateOperation {
  operation: JournalStateOperation
  target: string
  stage: string
  backup: string
}

function stateTransactionRelativePaths(
  workspaceRelativePath: string,
  transactionId: string,
  index: number,
): { stageRelativePath: string; backupRelativePath: string } {
  const parent = path.posix.dirname(workspaceRelativePath)
  const prefix = path.posix.join(parent, STATE_TRANSACTION_DIRECTORY, transactionId)
  const filename = index.toString().padStart(6, '0')
  return {
    stageRelativePath: path.posix.join(prefix, 'stage', filename),
    backupRelativePath: path.posix.join(prefix, 'backup', filename),
  }
}

async function resolvedJournalStateOperations(
  journal: TransactionJournal,
  recoveryContext?: TransactionRecoveryContext,
): Promise<{ context?: ResolvedRecoveryContext; operations: ResolvedJournalStateOperation[] }> {
  if (journal.schemaVersion === 1) return { operations: [] }
  const context = await resolveRecoveryContext(recoveryContext)
  if (context.workspaceRootHash !== journal.workspaceRootHash) {
    throw new TransactionStateFileError(
      'TRANSACTION_STATE_FILE_OUTSIDE_WORKSPACE',
      undefined,
      undefined,
      'The transaction journal belongs to a different trusted Workspace.',
    )
  }
  const operations: ResolvedJournalStateOperation[] = []
  const ids = new Set<string>()
  const targets = new Set<string>()
  for (const operation of journal.stateOperations) {
    if (ids.has(operation.id) || targets.has(operation.workspaceRelativePath)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', operation.id, operation.workspaceRelativePath, 'The journal contains duplicate controlled state identities.')
    }
    ids.add(operation.id)
    targets.add(operation.workspaceRelativePath)
    const expected = stateTransactionRelativePaths(operation.workspaceRelativePath, journal.transactionId, operation.index)
    if (operation.stageRelativePath !== expected.stageRelativePath || operation.backupRelativePath !== expected.backupRelativePath) {
      throw new TransactionStateFileError('TRANSACTION_STATE_RECOVERY_FAILED', operation.id, operation.workspaceRelativePath, 'The journal state staging identity is invalid.')
    }
    await assertNoStateSymlinkSegments(context, operation.workspaceRelativePath, operation.id)
    await assertNoStateSymlinkSegments(context, operation.stageRelativePath, operation.id)
    await assertNoStateSymlinkSegments(context, operation.backupRelativePath, operation.id)
    operations.push({
      operation,
      target: resolveStatePath(context, operation.workspaceRelativePath, operation.id),
      stage: resolveStatePath(context, operation.stageRelativePath, operation.id, true),
      backup: resolveStatePath(context, operation.backupRelativePath, operation.id, true),
    })
  }
  return { context, operations }
}

async function removeKnownStateTransactionFiles(operations: readonly ResolvedJournalStateOperation[]): Promise<void> {
  const transactionRoots = new Set<string>()
  for (const item of operations) {
    for (const candidate of [item.stage, item.backup]) {
      await unlink(candidate).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
    }
    transactionRoots.add(path.dirname(path.dirname(item.stage)))
  }
  for (const transactionRoot of [...transactionRoots].sort((left, right) => right.length - left.length || compareText(left, right))) {
    for (const area of ['stage', 'backup']) {
      await rmdir(path.join(transactionRoot, area)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
      })
    }
    await rmdir(transactionRoot).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
    })
    await rmdir(path.dirname(transactionRoot)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
    })
  }
}

async function cleanupJournal(
  outputRoot: string,
  journal: TransactionJournal,
  recoveryContext?: TransactionRecoveryContext,
): Promise<void> {
  const state = await resolvedJournalStateOperations(journal, recoveryContext)
  await removeKnownTransactionFiles(outputRoot, journal)
  await removeKnownStateTransactionFiles(state.operations)
  await unlink(path.join(outputRoot, OUTPUT_TRANSACTION_JOURNAL)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await unlink(path.join(outputRoot, `${OUTPUT_TRANSACTION_JOURNAL}.tmp`)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await syncDirectory(outputRoot)
}

async function removeTargetIfMatches(filePath: string, expected: OutputFileSnapshot): Promise<void> {
  const current = await snapshotOutputFile(filePath)
  if (!current.exists) return
  if (!outputSnapshotsEqual(current, expected)) throw new OutputRecoveryRequiredError('A transaction target changed and cannot be recovered automatically.')
  await unlink(filePath)
}

async function restoreOperation(outputRoot: string, journal: TransactionJournal, operation: JournalOperation): Promise<void> {
  const target = safeRelativePath(outputRoot, operation.path)
  const backup = transactionPath(outputRoot, journal.transactionId, 'backup', operation.index)
  const backupState = await snapshotOutputFile(backup)
  const targetState = await snapshotOutputFile(target)
  if (operation.before.exists) {
    if (targetState.exists && outputSnapshotsEqual(targetState, operation.before)) return
    if (!backupState.exists || !outputSnapshotsEqual(backupState, operation.before)) throw new OutputRecoveryRequiredError('A required transaction backup is missing or changed.')
    if (targetState.exists) await removeTargetIfMatches(target, operation.after)
    await mkdir(path.dirname(target), { recursive: true })
    await rename(backup, target)
    return
  }
  if (targetState.exists) await removeTargetIfMatches(target, operation.after)
}

async function restoreStateOperation(item: ResolvedJournalStateOperation): Promise<void> {
  const { operation, target, backup } = item
  try {
    const backupState = await snapshotOutputFile(backup)
    const targetState = await snapshotOutputFile(target)
    if (operation.before.exists) {
      if (outputSnapshotsEqual(targetState, operation.before)) return
      if (!backupState.exists || !outputSnapshotsEqual(backupState, operation.before)) {
        throw new TransactionStateFileError('TRANSACTION_STATE_RECOVERY_FAILED', operation.id, operation.workspaceRelativePath, 'A required controlled state backup is missing or changed.')
      }
      if (targetState.exists) await removeTargetIfMatches(target, operation.after)
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
      await rename(backup, target)
      await Promise.all([syncDirectory(path.dirname(target)), syncDirectory(path.dirname(backup))])
      return
    }
    if (targetState.exists) {
      await removeTargetIfMatches(target, operation.after)
      await syncDirectory(path.dirname(target))
    }
  } catch (error) {
    if (error instanceof TransactionStateFileError) throw error
    throw new TransactionStateFileError('TRANSACTION_STATE_RECOVERY_FAILED', operation.id, operation.workspaceRelativePath, 'Controlled state recovery could not prove complete restoration.')
  }
}

async function rollbackJournal(
  outputRoot: string,
  journal: TransactionJournal,
  recoveryContext?: TransactionRecoveryContext,
): Promise<void> {
  const state = await resolvedJournalStateOperations(journal, recoveryContext)
  for (const operation of [...state.operations].reverse()) await restoreStateOperation(operation)
  for (const operation of [...journal.operations].reverse()) await restoreOperation(outputRoot, journal, operation)
  const manifestPath = path.join(outputRoot, ARTIFACT_MANIFEST_FILENAME)
  const manifestBackup = path.join(outputRoot, OUTPUT_TRANSACTION_DIRECTORY, journal.transactionId, 'backup', 'manifest')
  const backupState = await snapshotOutputFile(manifestBackup)
  const currentManifest = await snapshotOutputFile(manifestPath)
  if (journal.manifestBefore.exists) {
    if (!outputSnapshotsEqual(currentManifest, journal.manifestBefore)) {
      if (!backupState.exists || !outputSnapshotsEqual(backupState, journal.manifestBefore)) throw new OutputRecoveryRequiredError('The ownership manifest backup is missing or changed.')
      if (currentManifest.exists) await removeTargetIfMatches(manifestPath, journal.manifestAfter)
      await rename(manifestBackup, manifestPath)
    }
  } else if (currentManifest.exists) {
    await removeTargetIfMatches(manifestPath, journal.manifestAfter)
  }
  for (const relativeDirectory of [...journal.createdDirectories].sort((left, right) => right.length - left.length)) {
    await rmdir(path.resolve(outputRoot, ...relativeDirectory.split('/'))).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error
    })
  }
  if (journal.schemaVersion === 2 && state.context) {
    await removeKnownStateTransactionFiles(state.operations)
    for (const relativeDirectory of [...journal.stateCreatedDirectories].sort((left, right) => right.length - left.length || compareText(right, left))) {
      const absolute = resolveStateCreatedDirectory(state.context, relativeDirectory)
      await rmdir(absolute).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error
      })
    }
  }
  await cleanupJournal(outputRoot, journal, recoveryContext)
}

async function verifyCommittedJournal(
  outputRoot: string,
  journal: TransactionJournal,
  recoveryContext?: TransactionRecoveryContext,
): Promise<void> {
  for (const operation of journal.operations) {
    const target = safeRelativePath(outputRoot, operation.path)
    const current = await snapshotOutputFile(target)
    if (!outputSnapshotsEqual(current, operation.after)) throw new OutputRecoveryRequiredError('A committed transaction target does not match its journal.')
  }
  const currentManifest = await snapshotOutputFile(path.join(outputRoot, ARTIFACT_MANIFEST_FILENAME))
  if (!outputSnapshotsEqual(currentManifest, journal.manifestAfter)) throw new OutputRecoveryRequiredError('The committed ownership manifest does not match its journal.')
  const state = await resolvedJournalStateOperations(journal, recoveryContext)
  for (const item of state.operations) {
    const current = await snapshotOutputFile(item.target)
    if (!outputSnapshotsEqual(current, item.operation.after)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_VERIFY_FAILED', item.operation.id, item.operation.workspaceRelativePath, 'A committed controlled state file does not match its journal.')
    }
  }
}

export async function recoverOutputTransaction(
  lock: OutputWriteLock,
  recoveryContext?: TransactionRecoveryContext,
): Promise<'none' | 'rolled-back' | 'completed'> {
  lock.assertActive(lock.outputRoot)
  await lock.assertStable()
  const journal = await readJournal(lock.outputRoot)
  if (!journal) return 'none'
  const canonicalRoot = await realpath(lock.outputRoot)
  if (journal.outputRootHash !== createHash('sha256').update(canonicalRoot).digest('hex')) throw new OutputRecoveryRequiredError('The transaction journal belongs to a different output root.')
  if (journal.phase === 'committed') {
    await verifyCommittedJournal(lock.outputRoot, journal, recoveryContext)
    await cleanupJournal(lock.outputRoot, journal, recoveryContext)
    return 'completed'
  }
  if (journal.phase === 'staging') {
    if (journal.schemaVersion === 2) await rollbackJournal(lock.outputRoot, journal, recoveryContext)
    else await cleanupJournal(lock.outputRoot, journal, recoveryContext)
    return 'rolled-back'
  }
  await rollbackJournal(lock.outputRoot, journal, recoveryContext)
  return 'rolled-back'
}

function manifestBytes(artifacts: readonly MaterializedArtifact[], generatorVersion: string): Uint8Array | undefined {
  if (artifacts.length === 0) return undefined
  const files = [...artifacts]
    .sort((left, right) => compareText(left.relativePath, right.relativePath))
    .map((artifact) => ({ path: artifact.relativePath, sha256: artifact.hash, bytes: artifact.content.byteLength, kind: artifact.kind }))
  return encoder.encode(`${JSON.stringify({ version: 2, generator: { name: 'openapi-to', version: generatorVersion }, files }, null, 2)}\n`)
}

async function createdTargetDirectories(outputRoot: string, operations: readonly JournalOperation[]): Promise<string[]> {
  const directories = new Set<string>()
  for (const operation of operations) {
    if (operation.status === 'deleted') continue
    let current = path.posix.dirname(operation.path)
    while (current !== '.') {
      const absolute = path.resolve(outputRoot, ...current.split('/'))
      try {
        const metadata = await lstat(absolute)
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new OutputPreconditionChangedError(operation.path)
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        directories.add(current)
        current = path.posix.dirname(current)
      }
    }
  }
  return [...directories].sort((left, right) => left.length - right.length || compareText(left, right))
}

async function createdStateDirectories(
  context: ResolvedRecoveryContext,
  stateFiles: readonly TransactionStateFile[],
): Promise<string[]> {
  const directories = new Set<string>()
  for (const stateFile of stateFiles) {
    let current = path.posix.dirname(stateFile.workspaceRelativePath)
    while (current !== '.') {
      const absolute = path.resolve(context.workspaceRoot, ...current.split('/'))
      try {
        const metadata = await lstat(absolute)
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', stateFile.id, stateFile.workspaceRelativePath, 'A controlled state parent is not a real directory.')
        }
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        directories.add(current)
        current = path.posix.dirname(current)
      }
    }
  }
  return [...directories].sort((left, right) => left.length - right.length || compareText(left, right))
}

async function prepareStateOperations(
  outputRoot: string,
  transactionId: string,
  stateFiles: readonly TransactionStateFile[],
  recoveryContext: TransactionRecoveryContext | undefined,
): Promise<{
  context?: ResolvedRecoveryContext
  operations: PreparedStateOperation[]
  stateCreatedDirectories: string[]
  stateBytes: number
}> {
  if (stateFiles.length === 0) return { operations: [], stateCreatedDirectories: [], stateBytes: 0 }
  if (stateFiles.length > DEFAULT_MAX_TRANSACTION_STATE_FILES) {
    throw new TransactionStateFileError('TRANSACTION_STATE_FILE_TOO_LARGE', undefined, undefined, 'The transaction contains too many controlled state files.')
  }
  const context = await resolveRecoveryContext(recoveryContext)
  const outputMetadata = await lstat(outputRoot, { bigint: true })
  const ids = new Set<string>()
  const paths = new Set<string>()
  const operations: PreparedStateOperation[] = []
  let stateBytes = 0
  for (const [index, source] of stateFiles.entries()) {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(source.id) || ids.has(source.id)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', source.id, undefined, 'A controlled state file id is invalid or duplicated.')
    }
    ids.add(source.id)
    const relativePath = normalizedWorkspaceRelativePath(source.workspaceRelativePath)
    if (paths.has(relativePath)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', source.id, relativePath, 'A controlled state path is duplicated.')
    }
    paths.add(relativePath)
    if (!Number.isInteger(source.maxBytes) || source.maxBytes < 0 || source.maxBytes > DEFAULT_MAX_TRANSACTION_STATE_FILE_BYTES) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_TOO_LARGE', source.id, relativePath, 'A controlled state file limit is invalid or exceeds the transaction maximum.')
    }
    if (!validStateSnapshot(source.expectedBefore, source.expectedBefore?.exists === true)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', source.id, relativePath, 'A controlled state precondition snapshot is incomplete or invalid.')
    }
    const desiredBytes = new Uint8Array(source.desiredBytes)
    stateBytes += desiredBytes.byteLength
    if (desiredBytes.byteLength > source.maxBytes || stateBytes > DEFAULT_MAX_TRANSACTION_STATE_TOTAL_BYTES) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_TOO_LARGE', source.id, relativePath, 'Controlled state bytes exceed the transaction limit.')
    }
    if (!/^[a-f0-9]{64}$/.test(source.desiredSha256) || hashBytes(desiredBytes) !== source.desiredSha256) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', source.id, relativePath, 'Controlled state desired bytes do not match their declared hash.')
    }
    const absolutePath = resolveStatePath(context, relativePath, source.id)
    const relativeToOutput = path.relative(outputRoot, absolutePath)
    if (relativeToOutput === '' || (!relativeToOutput.startsWith(`..${path.sep}`) && relativeToOutput !== '..' && !path.isAbsolute(relativeToOutput))) {
      throw new TransactionStateFileError('TRANSACTION_STATE_FILE_INVALID', source.id, relativePath, 'Controlled state files must remain outside the generated output root.')
    }
    await assertNoStateSymlinkSegments(context, relativePath, source.id)
    const parent = await nearestExistingDirectory(path.dirname(absolutePath))
    if (parent.device !== outputMetadata.dev.toString()) {
      throw new TransactionStateFileError(
        'SELECTIVE_STATE_CROSS_DEVICE_UNSUPPORTED',
        source.id,
        relativePath,
        'Generated output and controlled state must be on the same filesystem for crash-safe commit.',
      )
    }
    let before: OutputFileSnapshot
    try {
      before = await snapshotOutputFile(absolutePath)
    } catch (error) {
      throw new TransactionStateFileError(
        error instanceof OutputPreconditionChangedError ? 'TRANSACTION_STATE_FILE_INVALID' : 'TRANSACTION_STATE_SNAPSHOT_MISMATCH',
        source.id,
        relativePath,
        'A controlled state file is not a safe regular file.',
      )
    }
    if (!stateSnapshotMatchesExpected(before, source.expectedBefore)) {
      throw new TransactionStateFileError('TRANSACTION_STATE_SNAPSHOT_MISMATCH', source.id, relativePath, 'A controlled state file changed after its expected snapshot was captured.')
    }
    const transactionPaths = stateTransactionRelativePaths(relativePath, transactionId, index)
    operations.push({
      index,
      id: source.id,
      workspaceRelativePath: relativePath,
      before,
      after: { exists: true, sha256: source.desiredSha256, bytes: desiredBytes.byteLength },
      ...transactionPaths,
      desiredBytes,
      absolutePath,
      stagePath: resolveStatePath(context, transactionPaths.stageRelativePath, source.id, true),
      backupPath: resolveStatePath(context, transactionPaths.backupRelativePath, source.id, true),
    })
  }
  return {
    context,
    operations,
    stateCreatedDirectories: await createdStateDirectories(context, stateFiles),
    stateBytes,
  }
}

async function assertExpectedSnapshot(filePath: string, expected: OutputFileSnapshot, relativePath: string): Promise<void> {
  const current = await snapshotOutputFile(filePath)
  if (!outputSnapshotsEqual(current, expected)) throw new OutputPreconditionChangedError(relativePath)
}

async function assertExpectedStateSnapshot(operation: PreparedStateOperation): Promise<void> {
  const current = await snapshotOutputFile(operation.absolutePath)
  if (!stateSnapshotMatchesExpected(current, operation.before)) {
    throw new TransactionStateFileError(
      'TRANSACTION_STATE_SNAPSHOT_MISMATCH',
      operation.id,
      operation.workspaceRelativePath,
      'A controlled state file changed before commit.',
    )
  }
}

function invokeFailpoint(options: OutputTransactionOptions, failpoint: TransactionFailpoint): void {
  if (options.testCrashAt === failpoint) process.kill(process.pid, 'SIGKILL')
  if (options.testFailpoint === failpoint) throw new Error(`Injected transaction failure at ${failpoint}.`)
}

export async function commitGenerationStateTransaction(
  lock: OutputWriteLock,
  artifacts: readonly MaterializedArtifact[],
  manifest: GenerationManifest,
  stateFiles: readonly TransactionStateFile[],
  options: OutputTransactionOptions = {},
): Promise<OutputTransactionResult> {
  lock.assertActive(manifest.outputRoot)
  await lock.assertStable()
  throwIfAborted(options.signal)
  const outputRoot = lock.outputRoot
  if (await readJournal(outputRoot)) throw new OutputRecoveryRequiredError()
  const artifactByPath = new Map(artifacts.map((artifact) => [artifact.relativePath, artifact]))
  const changedEntries = manifest.entries.filter((entry) => entry.status !== 'unchanged')
  const operations: JournalOperation[] = []
  for (const [index, entry] of changedEntries.entries()) {
    const absolutePath = safeRelativePath(outputRoot, entry.path)
    await assertNoSymlinkSegments(outputRoot, entry.path)
    const before = await snapshotOutputFile(absolutePath)
    const artifact = artifactByPath.get(entry.path)
    if (entry.status === 'added') {
      if (before.exists || !artifact) throw new OutputPreconditionChangedError(entry.path)
    } else {
      if (!before.exists || !entry.previousHash || before.sha256 !== entry.previousHash) throw new OutputPreconditionChangedError(entry.path)
    }
    operations.push({
      index,
      path: entry.path,
      status: entry.status as JournalOperation['status'],
      ...(artifact ? { kind: artifact.kind } : {}),
      before,
      after: entry.status === 'deleted'
        ? { exists: false }
        : { exists: true, sha256: artifact?.hash, bytes: artifact?.content.byteLength },
    })
  }
  const ownershipPath = path.join(outputRoot, ARTIFACT_MANIFEST_FILENAME)
  const manifestBefore = await snapshotOutputFile(ownershipPath)
  if (options.expectedOwnershipManifest && !outputSnapshotsEqual(manifestBefore, options.expectedOwnershipManifest)) {
    throw new OutputPreconditionChangedError(ARTIFACT_MANIFEST_FILENAME)
  }
  const plannedManifest = manifestBytes(artifacts, options.generatorVersion ?? 'unknown')
  const manifestAfter: OutputFileSnapshot = plannedManifest
    ? { exists: true, sha256: hashBytes(plannedManifest), bytes: plannedManifest.byteLength }
    : { exists: false }
  const transactionId = randomUUID()
  const transactionStarted = performance.now()
  const createdDirectories = await createdTargetDirectories(outputRoot, operations)
  const preparedState = await prepareStateOperations(outputRoot, transactionId, stateFiles, options.recoveryContext)
  const commonJournal = {
    transactionId,
    outputRootHash: createHash('sha256').update(await realpath(outputRoot)).digest('hex'),
    phase: 'staging' as const,
    operations,
    manifestBefore,
    manifestAfter,
    createdDirectories,
  }
  const journal: TransactionJournalPayload = preparedState.operations.length > 0 && preparedState.context
    ? {
        schemaVersion: 2,
        ...commonJournal,
        workspaceRootHash: preparedState.context.workspaceRootHash,
        stateOperations: preparedState.operations.map(({ desiredBytes: _desiredBytes, absolutePath: _absolutePath, stagePath: _stagePath, backupPath: _backupPath, ...operation }) => operation),
        stateCreatedDirectories: preparedState.stateCreatedDirectories,
      }
    : { schemaVersion: 1, ...commonJournal }
  const transactionRoot = path.join(outputRoot, OUTPUT_TRANSACTION_DIRECTORY, transactionId)
  await mkdir(path.join(transactionRoot, 'stage'), { recursive: true, mode: 0o700 })
  await mkdir(path.join(transactionRoot, 'backup'), { recursive: true, mode: 0o700 })
  await writeJournal(outputRoot, journal)
  for (const operation of preparedState.operations) {
    await mkdir(path.dirname(operation.absolutePath), { recursive: true, mode: 0o700 })
    await mkdir(path.dirname(operation.stagePath), { recursive: true, mode: 0o700 })
    await mkdir(path.dirname(operation.backupPath), { recursive: true, mode: 0o700 })
  }
  let commitStarted = false
  let journalCommitted = false
  let commitStartedAt = 0
  let rollbackPerformed = false
  let commitDeadline = Number.POSITIVE_INFINITY
  const checkCommitDeadline = () => {
    if (Date.now() > commitDeadline) throw new OutputCommitTimeoutError()
  }
  try {
    const stageOperations = operations.filter((operation) => operation.status !== 'deleted')
    for (const [position, operation] of stageOperations.entries()) {
      throwIfAborted(options.signal)
      const artifact = artifactByPath.get(operation.path)
      if (!artifact) throw new Error(`Missing materialized artifact for ${operation.path}`)
      await writeSyncedFile(transactionPath(outputRoot, transactionId, 'stage', operation.index), artifact.content)
      const staged = await snapshotOutputFile(transactionPath(outputRoot, transactionId, 'stage', operation.index))
      if (!outputSnapshotsEqual(staged, operation.after)) throw new Error(`Staged artifact hash mismatch for ${operation.path}`)
      if (position === 0) invokeFailpoint(options, 'staging-first')
      if (position === Math.floor(stageOperations.length / 2)) invokeFailpoint(options, 'staging-middle')
    }
    if (plannedManifest) {
      invokeFailpoint(options, 'manifest-temp')
      const stageManifest = path.join(transactionRoot, 'stage', 'manifest')
      await writeSyncedFile(stageManifest, plannedManifest)
      const stagedManifest = await snapshotOutputFile(stageManifest)
      if (!outputSnapshotsEqual(stagedManifest, manifestAfter)) throw new Error('Staged ownership manifest hash mismatch.')
    }
    for (const [position, operation] of preparedState.operations.entries()) {
      throwIfAborted(options.signal)
      try {
        if (position === 0) invokeFailpoint(options, 'state-stage')
        await writeSyncedFile(operation.stagePath, operation.desiredBytes)
        await syncDirectory(path.dirname(operation.stagePath))
        const staged = await snapshotOutputFile(operation.stagePath)
        if (!outputSnapshotsEqual(staged, operation.after)) {
          throw new TransactionStateFileError('TRANSACTION_STATE_STAGE_FAILED', operation.id, operation.workspaceRelativePath, 'A staged controlled state file failed hash verification.')
        }
      } catch (error) {
        if (error instanceof TransactionStateFileError) throw error
        throw new TransactionStateFileError('TRANSACTION_STATE_STAGE_FAILED', operation.id, operation.workspaceRelativePath, 'A controlled state file could not be staged safely.')
      }
    }
    if (preparedState.operations.length > 0) invokeFailpoint(options, 'state-after-stage')
    invokeFailpoint(options, 'staging-complete')
    await options.onPhase?.('staged')
    throwIfAborted(options.signal)
    await lock.assertStable()

    commitStarted = true
    commitStartedAt = performance.now()
    commitDeadline = Date.now() + (options.commitTimeoutMs ?? 60_000)
    journal.phase = 'backup'
    await writeJournal(outputRoot, journal)
    await options.onPhase?.('backup')
    const backupOperations = operations.filter((operation) => operation.before.exists)
    for (const [position, operation] of backupOperations.entries()) {
      checkCommitDeadline()
      await lock.assertStable()
      await assertExpectedSnapshot(safeRelativePath(outputRoot, operation.path), operation.before, operation.path)
      await rename(safeRelativePath(outputRoot, operation.path), transactionPath(outputRoot, transactionId, 'backup', operation.index))
      if (position === 0) invokeFailpoint(options, 'backup-first')
      if (operation.status === 'deleted') invokeFailpoint(options, 'delete-first')
    }
    if (manifestBefore.exists) {
      await assertExpectedSnapshot(ownershipPath, manifestBefore, ARTIFACT_MANIFEST_FILENAME)
      await rename(ownershipPath, path.join(transactionRoot, 'backup', 'manifest'))
      invokeFailpoint(options, 'manifest-backup')
    }
    for (const [position, operation] of preparedState.operations.entries()) {
      checkCommitDeadline()
      try {
        await assertExpectedStateSnapshot(operation)
        if (position === 0) invokeFailpoint(options, 'state-backup')
        if (operation.before.exists) {
          await rename(operation.absolutePath, operation.backupPath)
          await Promise.all([syncDirectory(path.dirname(operation.absolutePath)), syncDirectory(path.dirname(operation.backupPath))])
        }
      } catch (error) {
        if (error instanceof TransactionStateFileError) throw error
        throw new TransactionStateFileError('TRANSACTION_STATE_BACKUP_FAILED', operation.id, operation.workspaceRelativePath, 'A controlled state file could not be backed up safely.')
      }
    }
    if (preparedState.operations.length > 0) invokeFailpoint(options, 'state-after-backup')

    journal.phase = 'committing'
    await writeJournal(outputRoot, journal)
    await options.onPhase?.('committing')
    await lock.assertStable()
    const renameOperations = operations.filter((operation) => operation.status !== 'deleted')
    for (const [position, operation] of renameOperations.entries()) {
      checkCommitDeadline()
      await lock.assertStable()
      const target = safeRelativePath(outputRoot, operation.path)
      await mkdir(path.dirname(target), { recursive: true })
      await rename(transactionPath(outputRoot, transactionId, 'stage', operation.index), target)
      if (position === 0) invokeFailpoint(options, 'rename-first')
      if (position === Math.floor(renameOperations.length / 2)) invokeFailpoint(options, 'rename-middle')
    }
    checkCommitDeadline()
    if (plannedManifest) {
      invokeFailpoint(options, 'manifest-rename')
      await rename(path.join(transactionRoot, 'stage', 'manifest'), ownershipPath)
    }
    for (const [position, operation] of preparedState.operations.entries()) {
      checkCommitDeadline()
      try {
        if (position === 0) invokeFailpoint(options, 'state-rename')
        await rename(operation.stagePath, operation.absolutePath)
        await Promise.all([syncDirectory(path.dirname(operation.stagePath)), syncDirectory(path.dirname(operation.absolutePath))])
      } catch (error) {
        if (error instanceof TransactionStateFileError) throw error
        throw new TransactionStateFileError('TRANSACTION_STATE_COMMIT_FAILED', operation.id, operation.workspaceRelativePath, 'A controlled state file could not be installed safely.')
      }
    }
    if (preparedState.operations.length > 0) invokeFailpoint(options, 'state-after-rename')
    if (preparedState.operations.length > 0) invokeFailpoint(options, 'state-verify')
    await verifyCommittedJournal(outputRoot, withChecksum(journal), options.recoveryContext)
    if (preparedState.operations.length > 0) invokeFailpoint(options, 'state-cleanup')
    invokeFailpoint(options, 'cleanup')
    journal.phase = 'committed'
    await writeJournal(outputRoot, journal)
    journalCommitted = true
    await options.onPhase?.('committed')
    const journalBytes = encoder.encode(`${stableJSON(withChecksum(journal))}\n`).byteLength
    await cleanupJournal(outputRoot, withChecksum(journal), options.recoveryContext)
    const outputStagedBytes = operations.reduce((total, operation) => total + (operation.after.bytes ?? 0), 0)
    const manifestStagedBytes = manifestAfter.bytes ?? 0
    const backupBytes = operations.reduce((total, operation) => total + (operation.before.bytes ?? 0), 0)
      + (manifestBefore.bytes ?? 0)
      + preparedState.operations.reduce((total, operation) => total + (operation.before.bytes ?? 0), 0)
    return {
      transactionId,
      added: manifest.summary.added,
      modified: manifest.summary.modified,
      deleted: manifest.summary.deleted,
      bytes: operations.reduce((total, operation) => total + (operation.after.bytes ?? 0), 0),
      rollbackPerformed,
      cancelledDuringCommit: options.signal?.aborted === true,
      stagingMs: Math.round(commitStartedAt - transactionStarted),
      commitMs: Math.round(performance.now() - commitStartedAt),
      stateFiles: preparedState.operations.length,
      stateBytes: preparedState.stateBytes,
      stagedBytes: outputStagedBytes + manifestStagedBytes + preparedState.stateBytes,
      backupBytes,
      journalBytes,
    }
  } catch (error) {
    const rollbackStarted = performance.now()
    let committedNeedsCleanup = false
    try {
      const persisted = await readJournal(outputRoot)
      if (persisted) {
        if (persisted.phase === 'committed') {
          await verifyCommittedJournal(outputRoot, persisted, options.recoveryContext)
          committedNeedsCleanup = true
        } else {
          await rollbackJournal(outputRoot, persisted, options.recoveryContext)
          rollbackPerformed = commitStarted
        }
      } else if (journalCommitted) {
        await verifyCommittedJournal(outputRoot, withChecksum(journal), options.recoveryContext)
        await writeJournal(outputRoot, journal)
        committedNeedsCleanup = true
      }
    } catch (rollbackError) {
      throw new OutputTransactionRollbackError(error, rollbackError, Math.round(performance.now() - rollbackStarted))
    }
    if (committedNeedsCleanup) {
      throw new OutputRecoveryRequiredError('The committed transaction is complete but requires cleanup recovery.')
    }
    if (commitStarted) throw new OutputTransactionRolledBackError(error, Math.round(performance.now() - rollbackStarted))
    throw error
  }
}

export async function commitOutputTransaction(
  lock: OutputWriteLock,
  artifacts: readonly MaterializedArtifact[],
  manifest: GenerationManifest,
  options: OutputTransactionOptions = {},
): Promise<OutputTransactionResult> {
  return commitGenerationStateTransaction(lock, artifacts, manifest, [], options)
}

export async function writeArtifactsTransaction(
  artifacts: readonly MaterializedArtifact[],
  manifest: GenerationManifest,
  options: OutputTransactionOptions = {},
): Promise<OutputTransactionResult> {
  const ownsLock = !options.lock
  const lock = options.lock ?? await acquireOutputWriteLock(manifest.outputRoot, {
    signal: options.signal,
    recoveryContext: options.recoveryContext,
  })
  try {
    return await commitOutputTransaction(lock, artifacts, manifest, options)
  } finally {
    if (ownsLock) await lock.release({ removeEmptyRoot: true })
  }
}
