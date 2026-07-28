import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { compileOpenAPI } from '@openapi-to/core'
import { describe, expect, it } from 'vitest'

import { TrustedConfigProvider } from '../generation/trusted-config.ts'
import { resolveMcpServerOptions } from '../options.ts'
import { TrustedTargetCatalogRegistry } from './trusted-target-registry.ts'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-catalog-registry-'))
  await mkdir(path.join(root, '.openapi-to'))
  await writeFile(path.join(root, 'first.yaml'), 'openapi: 3.1.0\ninfo: { title: First, version: "1" }\npaths: { /same: { get: { operationId: firstOperation, responses: { "200": { description: ok } } } } }\n')
  await writeFile(path.join(root, 'second.yaml'), 'openapi: 3.1.0\ninfo: { title: Second, version: "1" }\npaths: { /same: { get: { operationId: secondOperation, responses: { "200": { description: ok } } } } }\n')
  await writeFile(path.join(root, 'broken.yaml'), 'not: [valid')
  await writeFile(
    path.join(root, 'openapi.config.js'),
    `module.exports = { servers: [
      { name: 'first', input: { path: './first.yaml' }, output: { dir: 'first' } },
      { name: 'second', input: { path: './second.yaml' }, output: { dir: 'second' } },
      { name: 'broken', input: { path: './broken.yaml' }, output: { dir: 'broken' } }
    ], plugins: [] }\n`,
  )
  return root
}

describe('TrustedTargetCatalogRegistry', () => {
  it('deduplicates concurrent first compilation and isolates targets with the same method and path', async () => {
    const root = await fixture()
    const options = resolveMcpServerOptions({ workspaceRoot: root, configPath: 'openapi.config.js' })
    const provider = new TrustedConfigProvider(root, 'openapi.config.js')
    let compilationCount = 0
    const registry = new TrustedTargetCatalogRegistry(provider, options, async (...args) => {
      compilationCount += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return compileOpenAPI(...args)
    })
    const [left, right] = await Promise.all([registry.get('first'), registry.get('first')])
    expect(left).toBe(right)
    expect(compilationCount).toBe(1)
    expect(left.catalog?.items[0]).toMatchObject({ target: 'first', operationKey: 'firstOperation' })
    expect((await registry.get('second')).catalog?.items[0]).toMatchObject({ target: 'second', operationKey: 'secondOperation' })
    expect(compilationCount).toBe(2)
    await registry.get('first')
    expect(compilationCount).toBe(2)
  })

  it('does not retain failed compilations and can retry the same trusted target', async () => {
    const root = await fixture()
    const options = resolveMcpServerOptions({ workspaceRoot: root, configPath: 'openapi.config.js' })
    const provider = new TrustedConfigProvider(root, 'openapi.config.js')
    let compilationCount = 0
    const registry = new TrustedTargetCatalogRegistry(provider, options, async (...args) => {
      compilationCount += 1
      return compileOpenAPI(...args)
    })
    expect((await registry.get('broken')).success).toBe(false)
    await writeFile(path.join(root, 'broken.yaml'), 'openapi: 3.1.0\ninfo: { title: Fixed, version: "1" }\npaths: {}\n')
    expect((await registry.get('broken')).success).toBe(true)
    expect(compilationCount).toBe(2)
  })

  it('keeps discovery cached while allowing Apply to compile the current trusted bytes', async () => {
    const root = await fixture()
    const options = resolveMcpServerOptions({ workspaceRoot: root, configPath: 'openapi.config.js' })
    const provider = new TrustedConfigProvider(root, 'openapi.config.js')
    let compilationCount = 0
    const registry = new TrustedTargetCatalogRegistry(provider, options, async (...args) => {
      compilationCount += 1
      return compileOpenAPI(...args)
    })
    expect((await registry.get('first')).catalog?.items[0]?.operationKey).toBe('firstOperation')
    await writeFile(path.join(root, 'first.yaml'), 'openapi: 3.1.0\ninfo: { title: Current, version: "1" }\npaths: { /same: { get: { operationId: currentOperation, responses: { "200": { description: ok } } } } }\n')
    expect((await registry.get('first')).catalog?.items[0]?.operationKey).toBe('firstOperation')
    expect((await registry.getCurrent('first')).catalog?.items[0]?.operationKey).toBe('currentOperation')
    expect(compilationCount).toBe(2)
  })
})
