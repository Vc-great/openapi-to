import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { TrustedConfigProvider } from './trusted-config.ts'

describe('TrustedConfigProvider', () => {
  it('loads the startup path once and does not observe later config changes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-config-cache-'))
    const configPath = path.join(root, 'openapi.config.js')
    await writeFile(configPath, 'module.exports = { servers: [{ name: "first", input: { path: "a" }, output: { dir: "a" } }], plugins: [] }\n')
    const provider = new TrustedConfigProvider(root, configPath)
    const first = await provider.get()
    await writeFile(configPath, 'module.exports = { servers: [{ name: "second", input: { path: "b" }, output: { dir: "b" } }], plugins: [] }\n')
    const second = await provider.get()
    expect(first).toBe(second)
    expect(second.config.servers[0]?.name).toBe('first')
  })

  it('reports generation as unavailable without a startup config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mcp-config-cache-'))
    const provider = new TrustedConfigProvider(root)
    await expect(provider.get()).rejects.toMatchObject({ diagnostics: [{ code: 'MCP_CONFIG_NOT_AVAILABLE' }] })
  })
})
