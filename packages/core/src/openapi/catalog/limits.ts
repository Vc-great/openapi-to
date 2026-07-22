import type { GetOperationContractOptions } from './types.ts'

export const DEFAULT_OPERATION_SEARCH_LIMIT = 8
export const MAX_OPERATION_SEARCH_LIMIT = 50

export const DEFAULT_OPERATION_CONTRACT_LIMITS = {
  schemaDepth: 2,
  maxSchemas: 20,
  maxPropertiesPerSchema: 50,
  includeExamples: false,
  maxBytes: 128 * 1024,
} as const

export interface ResolvedOperationContractLimits {
  schemaDepth: number
  maxSchemas: number
  maxPropertiesPerSchema: number
  includeExamples: boolean
  maxBytes: number
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback
  return Math.max(0, Math.min(maximum, Math.floor(value)))
}

export function resolveOperationContractLimits(options: GetOperationContractOptions): ResolvedOperationContractLimits {
  return {
    schemaDepth: bounded(options.schemaDepth, DEFAULT_OPERATION_CONTRACT_LIMITS.schemaDepth, 10),
    maxSchemas: bounded(options.maxSchemas, DEFAULT_OPERATION_CONTRACT_LIMITS.maxSchemas, 100),
    maxPropertiesPerSchema: bounded(options.maxPropertiesPerSchema, DEFAULT_OPERATION_CONTRACT_LIMITS.maxPropertiesPerSchema, 500),
    includeExamples: options.includeExamples ?? DEFAULT_OPERATION_CONTRACT_LIMITS.includeExamples,
    maxBytes: Math.max(1024, bounded(options.maxBytes, DEFAULT_OPERATION_CONTRACT_LIMITS.maxBytes, 1024 * 1024)),
  }
}
