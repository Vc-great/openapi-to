import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import axios from 'axios'
import { vi } from 'vitest'
import type { CompatibleOpenAPIDocument } from '../types'
import { compileOpenAPI } from './compiler.ts'
import { resolveJSONPointer, resolveOpenAPIReferences } from './refResolver.ts'

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))

describe('$ref resolver', () => {
  it('resolves internal pointers including escaped tokens', () => {
    const document = { 'a/b~c': 42 }
    expect(resolveJSONPointer(document, '#/a~1b~0c')).toEqual({ found: true, value: 42 })
  })

  it('resolves multi-level YAML and JSON external references', async () => {
    const result = await compileOpenAPI(path.join(fixtureRoot, 'fixtures/refs/root.yaml'))
    expect(result.success).toBe(true)
    expect(result.references?.externalReferenceCount).toBeGreaterThanOrEqual(3)
    const resolved = result.resolvedDocument as unknown as {
      components: { schemas: { Pet: { properties: { owner: { properties: { id: { type: string } } } } }; Escaped: { type: string } } }
    }
    expect(resolved.components.schemas.Pet.properties.owner.properties.id.type).toBe('integer')
    expect(resolved.components.schemas.Escaped.type).toBe('string')
  })

  it('detects cycles without infinite recursion and reports missing references', async () => {
    const cycle = {
      openapi: '3.1.0',
      info: { title: 'Cycle', version: '1' },
      paths: {},
      components: { schemas: { Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' } } }, Missing: { $ref: '#/components/schemas/Nope' }, Invalid: { $ref: 42 } } },
    }
    const result = await resolveOpenAPIReferences(cycle as unknown as CompatibleOpenAPIDocument, pathToFileURL(path.join(process.cwd(), 'cycle.json')).toString())
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('OPENAPI_REF_CYCLE')
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('OPENAPI_REF_NOT_FOUND')
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('OPENAPI_REF_INVALID')
  })

  it('caches duplicate external reference loads', async () => {
    const request = vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/yaml' },
      data: '$defs:\n  Pet:\n    type: string\n',
    } as never)
    const root = {
      openapi: '3.1.0', info: { title: 'Cache', version: '1' }, paths: {},
      components: { schemas: { PetA: { $ref: 'http://127.0.0.1/schema.yaml#/$defs/Pet' }, PetB: { $ref: 'http://127.0.0.1/schema.yaml#/$defs/Pet' } } },
    }
    const result = await resolveOpenAPIReferences(root as unknown as CompatibleOpenAPIDocument, pathToFileURL(path.join(process.cwd(), 'cache.json')).toString(), { remote: { allowPrivateNetwork: true } })
    expect(result.diagnostics).toEqual([])
    expect(request).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('blocks non-HTTP references originating from a remote document', async () => {
    const root = { openapi: '3.1.0', info: { title: 'Remote', version: '1' }, paths: {}, components: { schemas: { Secret: { $ref: 'file:///etc/passwd' } } } }
    const result = await resolveOpenAPIReferences(root as unknown as CompatibleOpenAPIDocument, 'https://example.com/openapi.yaml')
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REMOTE_SOURCE_BLOCKED', severity: 'error' })]))
  })
})
