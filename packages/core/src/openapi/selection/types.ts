import type { Diagnostic } from '../../diagnostics.ts'

export const OPERATION_SELECTION_MANIFEST_VERSION = 1 as const
export const DEFAULT_MAX_SELECTION_OPERATIONS = 5_000
export const DEFAULT_MAX_SELECTION_BYTES = 1024 * 1024
export const MAX_OPERATION_SELECTION_KEY_BYTES = 500

export interface OperationSelectionMetadata {
  lastAppliedSpecHash?: string
  updatedAt?: string
}

export interface OperationSelectionManifestV1 {
  version: typeof OPERATION_SELECTION_MANIFEST_VERSION
  target: string
  selectionOwner: string
  operations: string[]
  metadata?: OperationSelectionMetadata
}

export type OperationSelectionManifest = OperationSelectionManifestV1

export type OperationSelectionMutation =
  | { type: 'add'; operationKeys: string[] }
  | { type: 'replace'; operationKeys: string[] }

export interface OperationSelectionMergeResult {
  manifest: OperationSelectionManifestV1
  mutationType: OperationSelectionMutation['type']
  previousOperationKeys: string[]
  requestedOperationKeys: string[]
  newlyAddedOperationKeys: string[]
  alreadySelectedOperationKeys: string[]
  retainedOperationKeys: string[]
  removedOperationKeys: string[]
  desiredOperationKeys: string[]
}

export type OperationSelectionMutationResult = OperationSelectionMergeResult

export interface OperationSelectionValidationOptions {
  expectedTarget?: string
  expectedSelectionOwner?: string
  maxOperations?: number
  maxBytes?: number
}

export interface OperationSelectionParseResult {
  manifest?: OperationSelectionManifestV1
  diagnostics: Diagnostic[]
}
