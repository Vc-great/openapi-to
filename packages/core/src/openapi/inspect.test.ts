import { describe, expect, it } from 'vitest'
import { inspectOpenAPIDocument } from './inspect.ts'

describe('OpenAPI inspection', () => {
  it('summarizes operations, tags, methods, security, and operationId quality', () => {
    const inspection = inspectOpenAPIDocument({
      openapi: '3.1.0',
      info: { title: 'Inspection', version: '1' },
      paths: {
        '/pets': {
          get: { operationId: 'listPets', tags: ['pets'], deprecated: true, responses: { '200': { description: 'ok' } } },
          post: { tags: ['pets'], responses: { '201': { description: 'created' } } },
        },
      },
      components: { schemas: { Pet: { type: 'object' } }, securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    })
    expect(inspection).toMatchObject({ pathCount: 1, operationCount: 2, schemaCount: 1, securitySchemes: ['bearer'], methodDistribution: { GET: 1, POST: 1 } })
    expect(inspection.tags).toEqual([{ name: 'pets', operations: 2 }])
    expect(inspection.deprecatedOperations).toHaveLength(1)
    expect(inspection.missingOperationIds).toEqual([{ path: '/pets', method: 'POST' }])
  })
})
