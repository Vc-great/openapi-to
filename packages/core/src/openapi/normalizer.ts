import type { CompatibleOpenAPIDocument } from '../types'
import { throwIfAborted, type OpenapiExecutionOptions } from '../execution.ts'

/**
 * Produce a deterministic, non-mutating representation for inspection and
 * comparison. Array order is preserved because it can carry API semantics;
 * object keys are sorted. Generators continue to receive the original parsed
 * document so existing output ordering remains compatible.
 */
export function normalizeOpenAPIDocument(document: CompatibleOpenAPIDocument, options: OpenapiExecutionOptions = {}): CompatibleOpenAPIDocument {
  const normalize = (value: unknown): unknown => {
    throwIfAborted(options.signal)
    if (Array.isArray(value)) return value.map(normalize)
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, normalize((value as Record<string, unknown>)[key])]))
  }
  return normalize(document) as CompatibleOpenAPIDocument
}
