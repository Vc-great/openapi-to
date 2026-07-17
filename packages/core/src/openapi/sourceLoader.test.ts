import path from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { compileOpenAPI } from './compiler.ts'
import { isPrivateIPAddress, loadOpenAPIDocument, validateRemoteURL } from './sourceLoader.ts'

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))

describe('OpenAPI source loader', () => {
  it('loads JSON and YAML based on content', async () => {
    const json = await loadOpenAPIDocument(path.resolve(fixtureRoot, '../../mock/openapiV3.json'))
    const yaml = await loadOpenAPIDocument(path.resolve(fixtureRoot, 'fixtures/openapi-3.2.yaml'))
    expect(json.document?.openapi).toMatch(/^3\.0\./)
    expect(yaml.document?.openapi).toBe('3.2.0')
  })

  it('accepts an object input', async () => {
    const result = await compileOpenAPI({ openapi: '3.1.0', info: { title: 'Object', version: '1' }, paths: {} })
    expect(result.success).toBe(true)
  })

  it('blocks private and local addresses by default', async () => {
    expect(isPrivateIPAddress('127.0.0.1')).toBe(true)
    expect(isPrivateIPAddress('169.254.169.254')).toBe(true)
    expect((await validateRemoteURL(new URL('http://127.0.0.1/openapi.yaml')))[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
    expect((await validateRemoteURL(new URL('file:///etc/passwd')))[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
  })

  it('rejects oversized remote responses without exposing query parameters', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'application/json' }, data: 'x'.repeat(20) } as never)
    const result = await loadOpenAPIDocument('http://127.0.0.1/openapi.json?token=secret', { remote: { allowPrivateNetwork: true, maxResponseBytes: 10 } })
    expect(result.diagnostics[0]?.code).toBe('REMOTE_SOURCE_TOO_LARGE')
    expect(JSON.stringify(result.diagnostics)).not.toContain('secret')
    vi.restoreAllMocks()
  })

  it('revalidates every redirect target', async () => {
    const request = vi.spyOn(axios, 'get').mockResolvedValueOnce({ status: 302, headers: { location: 'http://127.0.0.1/private.yaml' }, data: '' } as never)
    const result = await loadOpenAPIDocument('http://8.8.8.8/openapi.yaml')
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.diagnostics[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
    vi.restoreAllMocks()
  })
})
