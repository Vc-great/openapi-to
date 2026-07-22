import type { CompatibleOpenAPIDocument } from '../../types/index.ts'
import type { OperationCatalog, OperationCatalogItem } from './types.ts'

export interface OperationCatalogEntry {
  item: OperationCatalogItem
  pathItem: Record<string, unknown>
  operation: Record<string, unknown>
  resolvedPathItem?: Record<string, unknown>
  resolvedOperation?: Record<string, unknown>
}

export interface OperationCatalogState {
  document: CompatibleOpenAPIDocument
  resolvedDocument: CompatibleOpenAPIDocument
  entries: Map<string, OperationCatalogEntry>
}

const states = new WeakMap<OperationCatalog, OperationCatalogState>()

export function setOperationCatalogState(catalog: OperationCatalog, state: OperationCatalogState): void {
  states.set(catalog, state)
}

export function getOperationCatalogState(catalog: OperationCatalog): OperationCatalogState {
  const state = states.get(catalog)
  if (!state) throw new TypeError('Operation catalog was not created by buildOperationCatalog().')
  return state
}
