import { createHash } from 'node:crypto'

import { hasDiagnosticErrors, sortDiagnostics, type Diagnostic } from '../../diagnostics.ts'
import {
  DEFAULT_MAX_SELECTION_BYTES,
  DEFAULT_MAX_SELECTION_OPERATIONS,
  MAX_OPERATION_SELECTION_KEY_BYTES,
  OPERATION_SELECTION_MANIFEST_VERSION,
  type OperationSelectionManifestV1,
  type OperationSelectionMergeResult,
  type OperationSelectionMetadata,
  type OperationSelectionMutation,
  type OperationSelectionMutationResult,
  type OperationSelectionParseResult,
  type OperationSelectionValidationOptions,
} from './types.ts'

const encoder = new TextEncoder()

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  const accepted = new Set(allowed)
  return Object.keys(value).filter((key) => !accepted.has(key)).sort(compareText)
}

function diagnostic(code: string, message: string): Diagnostic {
  return { code, severity: 'error', message }
}

function validIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && encoder.encode(value).byteLength <= 500
}

function normalizeKeys(operationKeys: readonly string[]): string[] {
  return [...new Set(operationKeys)].sort(compareText)
}

function validateMetadata(value: unknown, diagnostics: Diagnostic[]): OperationSelectionMetadata | undefined {
  if (value === undefined) return undefined
  const metadata = record(value)
  if (!metadata) {
    diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', 'Selection metadata must be an object when present.'))
    return undefined
  }
  const extras = unknownKeys(metadata, ['lastAppliedSpecHash', 'updatedAt'])
  if (extras.length) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', `Selection metadata contains unsupported field(s): ${extras.join(', ')}.`))
  for (const key of ['lastAppliedSpecHash', 'updatedAt'] as const) {
    if (metadata[key] !== undefined && typeof metadata[key] !== 'string') {
      diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', `Selection metadata.${key} must be a string when present.`))
    }
  }
  if (hasDiagnosticErrors(diagnostics)) return undefined
  return {
    ...(typeof metadata.lastAppliedSpecHash === 'string' ? { lastAppliedSpecHash: metadata.lastAppliedSpecHash } : {}),
    ...(typeof metadata.updatedAt === 'string' ? { updatedAt: metadata.updatedAt } : {}),
  }
}

export function normalizeOperationSelection(
  target: string,
  selectionOwner: string,
  operations: readonly string[],
  metadata?: OperationSelectionMetadata,
): OperationSelectionManifestV1 {
  return {
    version: OPERATION_SELECTION_MANIFEST_VERSION,
    target,
    selectionOwner,
    operations: normalizeKeys(operations),
    ...(metadata ? { metadata: { ...metadata } } : {}),
  }
}

export function createEmptyOperationSelection(target: string, selectionOwner: string): OperationSelectionManifestV1 {
  return normalizeOperationSelection(target, selectionOwner, [])
}

export function validateOperationSelectionManifest(
  value: unknown,
  options: OperationSelectionValidationOptions = {},
): OperationSelectionParseResult {
  const diagnostics: Diagnostic[] = []
  const manifest = record(value)
  if (!manifest) return { diagnostics: [diagnostic('SELECTION_MANIFEST_INVALID', 'Selection manifest must be a JSON object.')] }

  const extras = unknownKeys(manifest, ['version', 'target', 'selectionOwner', 'operations', 'metadata'])
  if (extras.length) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', `Selection manifest contains unsupported field(s): ${extras.join(', ')}.`))
  if (manifest.version !== OPERATION_SELECTION_MANIFEST_VERSION) {
    diagnostics.push(diagnostic('SELECTION_MANIFEST_VERSION_UNSUPPORTED', `Selection manifest version ${String(manifest.version)} is not supported.`))
  }
  if (!validIdentity(manifest.target)) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', 'Selection manifest target must be a non-empty bounded string.'))
  if (!validIdentity(manifest.selectionOwner)) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', 'Selection manifest selectionOwner must be a non-empty bounded string.'))
  if (options.expectedTarget !== undefined && manifest.target !== options.expectedTarget) {
    diagnostics.push(diagnostic('SELECTION_TARGET_MISMATCH', `Selection manifest target does not match trusted target ${options.expectedTarget}.`))
  }
  if (options.expectedSelectionOwner !== undefined && manifest.selectionOwner !== options.expectedSelectionOwner) {
    diagnostics.push(diagnostic('SELECTION_OWNER_MISMATCH', 'Selection manifest owner does not match the trusted target and output identity.'))
  }

  const maximum = options.maxOperations ?? DEFAULT_MAX_SELECTION_OPERATIONS
  const operations = manifest.operations
  if (!Array.isArray(operations)) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', 'Selection manifest operations must be an array.'))
  else {
    if (operations.length > maximum) diagnostics.push(diagnostic('SELECTION_MANIFEST_TOO_LARGE', `Selection manifest exceeds the ${maximum} operation limit.`))
    const seen = new Set<string>()
    for (const operationKey of operations) {
      if (typeof operationKey !== 'string' || operationKey.length === 0 || encoder.encode(operationKey).byteLength > MAX_OPERATION_SELECTION_KEY_BYTES) {
        diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', 'Every selection operationKey must be a non-empty bounded string.'))
        continue
      }
      if (seen.has(operationKey)) diagnostics.push(diagnostic('SELECTION_MANIFEST_INVALID', `Selection manifest contains duplicate operationKey ${operationKey}.`))
      seen.add(operationKey)
    }
  }
  const metadata = validateMetadata(manifest.metadata, diagnostics)
  if (hasDiagnosticErrors(diagnostics) || !validIdentity(manifest.target) || !validIdentity(manifest.selectionOwner) || !Array.isArray(operations)) {
    return { diagnostics: sortDiagnostics(diagnostics) }
  }
  return {
    manifest: normalizeOperationSelection(
      manifest.target,
      manifest.selectionOwner,
      operations.filter((item): item is string => typeof item === 'string'),
      metadata,
    ),
    diagnostics: sortDiagnostics(diagnostics),
  }
}

export function parseOperationSelectionManifest(
  input: string | Uint8Array,
  options: OperationSelectionValidationOptions = {},
): OperationSelectionParseResult {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  const maximum = options.maxBytes ?? DEFAULT_MAX_SELECTION_BYTES
  if (bytes.byteLength > maximum) {
    return { diagnostics: [diagnostic('SELECTION_MANIFEST_TOO_LARGE', `Selection manifest exceeds the ${maximum} byte limit.`)] }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return { diagnostics: [diagnostic('SELECTION_MANIFEST_INVALID', 'Selection manifest is not valid UTF-8 JSON.')] }
  }
  return validateOperationSelectionManifest(parsed, options)
}

export function serializeOperationSelectionManifest(manifest: OperationSelectionManifestV1): string {
  const normalized = normalizeOperationSelection(manifest.target, manifest.selectionOwner, manifest.operations, manifest.metadata)
  return `${JSON.stringify(normalized, null, 2)}\n`
}

export function hashOperationSelection(manifest: OperationSelectionManifestV1): string {
  const semantic = {
    version: OPERATION_SELECTION_MANIFEST_VERSION,
    target: manifest.target,
    selectionOwner: manifest.selectionOwner,
    operations: normalizeKeys(manifest.operations),
  }
  return `sha256:${createHash('sha256').update(JSON.stringify(semantic)).digest('hex')}`
}

export function applyOperationSelectionMutation(
  previous: OperationSelectionManifestV1,
  mutation: OperationSelectionMutation,
): OperationSelectionMutationResult {
  if (mutation.type !== 'add' && mutation.type !== 'replace') {
    throw new TypeError('Only add and replace selection mutations are supported.')
  }
  const previousOperationKeys = normalizeKeys(previous.operations)
  const requestedOperationKeys = normalizeKeys(mutation.operationKeys)
  if (mutation.type === 'replace' && requestedOperationKeys.length === 0) {
    throw new TypeError('Replace selection mutations require at least one operationKey; clear is not supported.')
  }
  const previousSet = new Set(previousOperationKeys)
  const requestedSet = new Set(requestedOperationKeys)
  const newlyAddedOperationKeys = requestedOperationKeys.filter((operationKey) => !previousSet.has(operationKey))
  const alreadySelectedOperationKeys = requestedOperationKeys.filter((operationKey) => previousSet.has(operationKey))
  const retainedOperationKeys = previousOperationKeys.filter((operationKey) => mutation.type === 'add' || requestedSet.has(operationKey))
  const removedOperationKeys = mutation.type === 'replace'
    ? previousOperationKeys.filter((operationKey) => !requestedSet.has(operationKey))
    : []
  const desiredOperationKeys = mutation.type === 'replace'
    ? requestedOperationKeys
    : normalizeKeys([...previousOperationKeys, ...requestedOperationKeys])
  return {
    manifest: normalizeOperationSelection(previous.target, previous.selectionOwner, desiredOperationKeys, previous.metadata),
    mutationType: mutation.type,
    previousOperationKeys,
    requestedOperationKeys,
    newlyAddedOperationKeys,
    alreadySelectedOperationKeys,
    retainedOperationKeys,
    removedOperationKeys,
    desiredOperationKeys,
  }
}

export function mergeOperationSelection(
  previous: OperationSelectionManifestV1,
  mutation: OperationSelectionMutation,
): OperationSelectionMergeResult {
  return applyOperationSelectionMutation(previous, mutation)
}
