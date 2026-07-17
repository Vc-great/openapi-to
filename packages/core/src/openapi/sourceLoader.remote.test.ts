import { createServer, type Server } from 'node:http'
import { once } from 'node:events'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileOpenAPI } from './compiler.ts'
import { loadOpenAPIDocument } from './sourceLoader.ts'

describe.sequential('remote OpenAPI security policy', () => {
  let server: Server
  let baseURL: string
  let previousNoProxy: string | undefined

  beforeAll(async () => {
    previousNoProxy = process.env.NO_PROXY
    process.env.NO_PROXY = '127.0.0.1,localhost'
    server = createServer((request, response) => {
      const port = (server.address() as { port: number }).port
      if (request.url === '/json') {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ openapi: '3.1.0', info: { title: 'Remote JSON', version: '1' }, paths: {} }))
      } else if (request.url === '/yaml') {
        response.setHeader('content-type', 'application/yaml')
        response.end('openapi: 3.1.0\ninfo:\n  title: Remote YAML\n  version: "1"\npaths: {}\n')
      } else if (request.url === '/redirect') {
        response.writeHead(302, { location: '/json' }).end()
      } else if (request.url === '/redirect-private') {
        response.writeHead(302, { location: `http://localhost:${port}/json` }).end()
      } else if (request.url === '/slow') {
        setTimeout(() => response.end('openapi: 3.1.0'), 100)
      } else if (request.url?.startsWith('/large')) {
        response.end('x'.repeat(128))
      } else if (request.url === '/root.yaml') {
        response.end(`openapi: 3.1.0\ninfo:\n  title: External ref\n  version: "1"\npaths: {}\ncomponents:\n  schemas:\n    Pet:\n      $ref: http://localhost:${port}/schema.yaml#/$defs/Pet\n`)
      } else if (request.url === '/schema.yaml') {
        response.end('$defs:\n  Pet:\n    type: object\n')
      } else {
        response.writeHead(404).end()
      }
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  })

  afterAll(async () => {
    const closed = once(server, 'close')
    server.close()
    server.closeAllConnections()
    await closed
    if (previousNoProxy === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = previousNoProxy
  })

  const trustedLocal = { allowPrivateNetwork: true, allowedHosts: ['127.0.0.1'] }

  it('loads JSON, YAML, and a bounded same-host redirect with explicit private-network opt-in', async () => {
    const json = await loadOpenAPIDocument(`${baseURL}/json`, { remote: trustedLocal })
    const yaml = await loadOpenAPIDocument(`${baseURL}/yaml`, { remote: trustedLocal })
    const redirect = await loadOpenAPIDocument(`${baseURL}/redirect`, { remote: trustedLocal })
    expect(json.document?.info.title).toBe('Remote JSON')
    expect(yaml.document?.info.title).toBe('Remote YAML')
    expect(redirect.document?.info.title).toBe('Remote JSON')
  })

  it('blocks private networks by default and revalidates redirect hosts', async () => {
    const blocked = await loadOpenAPIDocument(`${baseURL}/json`)
    const redirect = await loadOpenAPIDocument(`${baseURL}/redirect-private`, { remote: trustedLocal })
    expect(blocked.diagnostics[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
    expect(redirect.diagnostics[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
  })

  it('enforces timeout, maximum size, host allowlists, and secret redaction', async () => {
    const timeout = await loadOpenAPIDocument(`${baseURL}/slow`, { remote: { ...trustedLocal, timeoutMs: 10 } })
    const large = await loadOpenAPIDocument(`${baseURL.replace('http://', 'http://user:password@')}/large?token=secret`, {
      remote: { ...trustedLocal, maxResponseBytes: 16 },
    })
    const disallowed = await loadOpenAPIDocument(`${baseURL}/json`, { remote: { allowPrivateNetwork: true, allowedHosts: ['example.com'] } })
    expect(timeout.diagnostics[0]?.code).toBe('REMOTE_SOURCE_TIMEOUT')
    expect(large.diagnostics[0]?.code).toBe('REMOTE_SOURCE_TOO_LARGE')
    expect(disallowed.diagnostics[0]?.code).toBe('REMOTE_SOURCE_BLOCKED')
    expect(JSON.stringify(large.diagnostics)).not.toMatch(/password|token|secret/)
  })

  it('applies the same redirect and host policy to external references', async () => {
    const result = await compileOpenAPI(`${baseURL}/root.yaml`, { remote: trustedLocal })
    expect(result.success).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REMOTE_SOURCE_BLOCKED' })]))
  })
})
