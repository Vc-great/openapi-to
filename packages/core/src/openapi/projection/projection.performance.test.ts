import { describe, expect, it } from 'vitest'

import type { CompatibleOpenAPIDocument } from '../../types/index.ts'
import { buildOperationCatalog } from '../catalog/builder.ts'
import { projectOpenAPIDocument } from './project.ts'

describe('large projection boundaries', () => {
  it('keeps a one-operation projection bounded and deterministic for a 700-operation/300-schema document', () => {
    const schemas = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`Schema${index}`, { type: 'object', properties: { value: { type: 'string' }, ...(index < 299 ? { next: { $ref: `#/components/schemas/Schema${index + 1}` } } : {}) } }]))
    const paths = Object.fromEntries(Array.from({ length: 700 }, (_, index) => [`/resources/${index}`, { get: { operationId: `getResource${index}`, responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: `#/components/schemas/Schema${index % 300}` } } } } } } }]))
    const source = { openapi: '3.1.0', info: { title: 'large', version: '1' }, paths, components: { schemas } } as unknown as CompatibleOpenAPIDocument
    const catalog = buildOperationCatalog(source, { target: 'large', resolvedDocument: source })
    const hashes = new Set<string>()
    for (let index = 0; index < 100; index += 1) {
      const result = projectOpenAPIDocument(source, source, catalog, { type: 'operations', operationKeys: ['getResource699'] }, { target: 'large', sourceHash: 'large-root' })
      expect(result.success).toBe(true)
      expect(result.stats).toMatchObject({ operationCount: 1, pathCount: 1, schemaCount: 201 })
      hashes.add(result.projectionHash as string)
    }
    expect(hashes.size).toBe(1)
  })
})
