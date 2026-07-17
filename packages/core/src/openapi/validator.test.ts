import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileOpenAPI } from './compiler.ts'

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))

describe('OpenAPI validator', () => {
  it('recognizes OpenAPI 3.2 in compatibility mode', async () => {
    const result = await compileOpenAPI(path.join(fixtureRoot, 'fixtures/openapi-3.2.yaml'))
    expect(result.success).toBe(true)
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OPENAPI_32_COMPATIBILITY', severity: 'warning' }), expect.objectContaining({ code: 'OPENAPI_32_FIELD_NOT_GENERATED' })]))
  })
})
