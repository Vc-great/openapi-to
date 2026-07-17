import { summarizeDiagnostics, type DiagnosticSummary } from '../diagnostics.ts'
import type { CompatibleOpenAPIDocument } from '../types'
import { HTTP_OPERATION_METHODS } from './validator.ts'

export interface OpenAPIInspection {
  openapiVersion: string
  title?: string
  apiVersion?: string
  pathCount: number
  operationCount: number
  tags: Array<{ name: string; operations: number }>
  schemaCount: number
  securitySchemes: string[]
  deprecatedOperations: Array<{ path: string; method: string; operationId?: string }>
  missingOperationIds: Array<{ path: string; method: string }>
  methodDistribution: Record<string, number>
  externalReferenceCount: number
  diagnostics: DiagnosticSummary
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

export function inspectOpenAPIDocument(document: CompatibleOpenAPIDocument, externalReferenceCount = 0, diagnostics = [] as Parameters<typeof summarizeDiagnostics>[0]): OpenAPIInspection {
  const root = document as Record<string, unknown>
  const info = record(root.info)
  const paths = record(root.paths) ?? {}
  const tags = new Map<string, number>()
  const deprecatedOperations: OpenAPIInspection['deprecatedOperations'] = []
  const missingOperationIds: OpenAPIInspection['missingOperationIds'] = []
  const methodDistribution: Record<string, number> = {}
  let operationCount = 0
  for (const pathName of Object.keys(paths).sort()) {
    const pathItem = record(paths[pathName])
    if (!pathItem) continue
    for (const method of [...HTTP_OPERATION_METHODS, 'query'] as const) {
      const operation = record(pathItem[method])
      if (!operation) continue
      operationCount += 1
      methodDistribution[method.toUpperCase()] = (methodDistribution[method.toUpperCase()] ?? 0) + 1
      const operationId = typeof operation.operationId === 'string' ? operation.operationId : undefined
      if (!operationId) missingOperationIds.push({ path: pathName, method: method.toUpperCase() })
      if (operation.deprecated === true) deprecatedOperations.push({ path: pathName, method: method.toUpperCase(), operationId })
      const operationTags = Array.isArray(operation.tags) && operation.tags.length > 0 ? operation.tags.filter((tag): tag is string => typeof tag === 'string') : ['default']
      for (const tag of operationTags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
    }
    const additional = record(pathItem.additionalOperations)
    if (additional) {
      for (const method of Object.keys(additional).sort()) {
        const operation = record(additional[method])
        if (!operation) continue
        operationCount += 1
        methodDistribution[method.toUpperCase()] = (methodDistribution[method.toUpperCase()] ?? 0) + 1
        if (typeof operation.operationId !== 'string') missingOperationIds.push({ path: pathName, method: method.toUpperCase() })
      }
    }
  }
  const components = record(root.components)
  const schemas = record(components?.schemas)
  const securitySchemes = record(components?.securitySchemes)
  return {
    openapiVersion: String(root.openapi ?? ''),
    title: typeof info?.title === 'string' ? info.title : undefined,
    apiVersion: typeof info?.version === 'string' ? info.version : undefined,
    pathCount: Object.keys(paths).length,
    operationCount,
    tags: [...tags].map(([name, operations]) => ({ name, operations })).sort((a, b) => a.name.localeCompare(b.name)),
    schemaCount: Object.keys(schemas ?? {}).length,
    securitySchemes: Object.keys(securitySchemes ?? {}).sort(),
    deprecatedOperations: deprecatedOperations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
    missingOperationIds: missingOperationIds.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
    methodDistribution: Object.fromEntries(Object.entries(methodDistribution).sort(([a], [b]) => a.localeCompare(b))),
    externalReferenceCount,
    diagnostics: summarizeDiagnostics(diagnostics),
  }
}
