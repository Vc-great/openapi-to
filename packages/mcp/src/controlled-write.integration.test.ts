import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rename, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { acquireOutputWriteLock } from '@openapi-to/core'
import { afterEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bin = path.join(repositoryRoot, 'packages/mcp/bin/openapi-to-mcp.js')
const openapiBin = path.join(repositoryRoot, 'packages/openapi/bin/openapi.js')

async function fixtureWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-mcp-controlled-write-'))
  await mkdir(path.join(root, '.OpenAPI'))
  await writeFile(path.join(root, 'openapi.yaml'), `openapi: 3.1.0
info: { title: Controlled Write, version: "1" }
paths:
  /ping:
    get:
      operationId: ping
      responses: { "200": { description: ok } }
`)
  await writeFile(
    path.join(root, '.OpenAPI/openapi.config.cjs'),
    `module.exports = {
  servers: [{ name: 'main', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } }],
  plugins: [{ name: 'controlled-write-fixture', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    ctx.addArtifact({ kind: 'text', path: root + '/client.txt', content: 'generated client\\n' });
    ctx.addArtifact({ kind: 'json', path: root + '/metadata.json', value: { stable: true } });
    ctx.addArtifact({ kind: 'binary', path: root + '/asset.bin', content: new Uint8Array([0, 1, 2, 3]) });
  } } }]
};
`,
  )
  return root
}

async function connect(root: string, allowWrite: boolean, extraArgs: string[] = []) {
  const stderr: string[] = []
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin, '--workspace-root', root, '--config', '.OpenAPI/openapi.config.cjs', ...(allowWrite ? ['--allow-write'] : []), ...extraArgs],
    stderr: 'pipe',
  })
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  const client = new Client({ name: 'openapi-controlled-write-test', version: '1.0.0' })
  await client.connect(transport)
  return { client, stderr }
}

function structured(result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
  return result.structuredContent as Record<string, unknown>
}

async function waitForFile(filePath: string, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      await access(filePath)
      return
    } catch {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${path.basename(filePath)}.`)
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}

async function runCliGenerate(root: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [openapiBin, 'generate', '--json'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI generate timed out while waiting for the shared writer lock.')) }, 10_000)
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') })
    })
  })
}

describe.sequential('controlled-write stdio tools', () => {
  const clients: Client[] = []
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close().catch(() => undefined)))
  })

  it('keeps the five-tool matrix without the operator write grant', async () => {
    const root = await fixtureWorkspace()
    const connected = await connect(root, false)
    clients.push(connected.client)
    expect((await connected.client.listTools()).tools.map(({ name }) => name)).toEqual([
      'openapi_validate',
      'openapi_inspect',
      'openapi_diff',
      'openapi_generate_dry_run',
      'openapi_check_generation',
    ])
  })

  it('refuses write-enabled startup when any configured output root escapes the Workspace', async () => {
    const root = await fixtureWorkspace()
    const configPath = path.join(root, '.OpenAPI/openapi.config.cjs')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, config.replace("dir: 'generated'", "dir: '../../../outside'"))
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin, '--workspace-root', root, '--config', '.OpenAPI/openapi.config.cjs', '--allow-write'],
      stderr: 'pipe',
    })
    const client = new Client({ name: 'openapi-controlled-write-invalid-root', version: '1.0.0' })
    await expect(client.connect(transport)).rejects.toThrow(/closed/i)
    await client.close().catch(() => undefined)
  })

  it('rejects a multi-target write plan instead of partially applying one output root', async () => {
    const root = await fixtureWorkspace()
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.cjs'),
      `module.exports = {
  servers: [
    { name: 'first', input: { path: './openapi.yaml' }, output: { dir: 'generated-a', clean: true } },
    { name: 'second', input: { path: './openapi.yaml' }, output: { dir: 'generated-b', clean: true } }
  ],
  plugins: [{ name: 'multi-target-fixture', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    ctx.addArtifact({ kind: 'text', path: root + '/client.txt', content: 'generated client\\n' });
  } } }]
};
`,
    )
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['first', 'second'] } })
    expect(prepared.isError).toBe(true)
    expect((structured(prepared).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_WRITE_SINGLE_TARGET_REQUIRED')
    await expect(access(path.join(root, '.OpenAPI/generated-a'))).rejects.toThrow()
    await expect(access(path.join(root, '.OpenAPI/generated-b'))).rejects.toThrow()
  })

  it('rejects an over-limit write plan without retaining an applyable half-plan', async () => {
    const root = await fixtureWorkspace()
    const connected = await connect(root, true, ['--max-write-files', '2'])
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    expect(prepared.isError).toBe(true)
    expect((structured(prepared).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_WRITE_LIMIT_EXCEEDED')
    expect(structured(prepared).plan).toBeUndefined()
    await expect(access(path.join(root, '.OpenAPI/generated'))).rejects.toThrow()
  })

  it('keeps the internal plan complete when the external Prepare change list is truncated', async () => {
    const root = await fixtureWorkspace()
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.cjs'),
      `module.exports = {
  servers: [{ name: 'main', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } }],
  plugins: [{ name: 'truncated-plan-fixture', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    for (let index = 0; index < 501; index += 1) ctx.addArtifact({ kind: 'text', path: root + '/file-' + String(index).padStart(4, '0') + '.txt', content: String(index) + '\\n' });
  } } }]
};
`,
    )
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } }, undefined, { timeout: 10_000 })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string; changes: unknown[]; truncated: { changes: boolean; total: number; returned: number } }
    expect(plan.changes).toHaveLength(500)
    expect(plan.truncated).toMatchObject({ changes: true, total: 501, returned: 500 })
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } }, undefined, { timeout: 10_000 })
    expect(structured(applied)).toMatchObject({ success: true, applied: true, summary: { added: 501 } })
    expect((await readdir(path.join(root, '.OpenAPI/generated'))).filter((name) => name.endsWith('.txt'))).toHaveLength(501)
  }, 20_000)

  it('prepares without writing, applies exactly once, and leaves generation current', async () => {
    const root = await fixtureWorkspace()
    const outputRoot = path.join(root, '.OpenAPI/generated')
    const connected = await connect(root, true)
    clients.push(connected.client)
    const tools = (await connected.client.listTools()).tools
    expect(tools.map(({ name }) => name)).toEqual([
      'openapi_validate',
      'openapi_inspect',
      'openapi_diff',
      'openapi_generate_dry_run',
      'openapi_check_generation',
      'openapi_prepare_generation',
      'openapi_apply_generation',
    ])
    expect(tools.find(({ name }) => name === 'openapi_prepare_generation')?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: false })
    expect(tools.find(({ name }) => name === 'openapi_apply_generation')?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: false })

    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'], includePreview: true } })
    expect(prepared.isError).not.toBe(true)
    expect(JSON.stringify(prepared.content)).toContain('no files or ownership manifest were written')
    await expect(access(outputRoot)).rejects.toThrow()
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string; summary: { added: number; deleted: number } }
    expect(plan.summary).toMatchObject({ added: 3, deleted: 0 })
    const concurrentPrepared = await Promise.all([
      connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'], includePreview: true } }),
      connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'], includePreview: true } }),
    ])
    for (const repeated of concurrentPrepared) {
      const repeatedPlan = structured(repeated).plan as { planId: string; token: string; planHash: string; changes: unknown[] }
      expect(repeatedPlan.planHash).toBe(plan.planHash)
      expect(repeatedPlan.planId).not.toBe(plan.planId)
      expect(repeatedPlan.token).not.toBe(plan.token)
      expect(repeatedPlan.changes).toEqual((structured(prepared).plan as { changes: unknown[] }).changes)
    }

    const forbiddenOverride = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash, force: true },
    })
    expect(forbiddenOverride.isError).toBe(true)
    expect(JSON.stringify(forbiddenOverride.content)).toContain('unrecognized_keys')

    const tampered = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: `${plan.token.slice(0, -1)}x`, approvedPlanHash: plan.planHash },
    })
    expect(tampered.isError).toBe(true)
    expect((structured(tampered).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_TOKEN_INVALID')
    await expect(access(outputRoot)).rejects.toThrow()

    const wrongHash = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: 'f'.repeat(64) },
    })
    expect((structured(wrongHash).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_HASH_MISMATCH')

    const applied = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
    })
    expect(applied.isError).not.toBe(true)
    expect(structured(applied)).toMatchObject({ success: true, applied: true, summary: { added: 3, modified: 0, deleted: 0 } })
    expect(await readFile(path.join(outputRoot, 'client.txt'), 'utf8')).toBe('generated client\n')
    expect(new Uint8Array(await readFile(path.join(outputRoot, 'asset.bin')))).toEqual(new Uint8Array([0, 1, 2, 3]))
    const ownership = JSON.parse(await readFile(path.join(outputRoot, '.openapi-to-manifest.json'), 'utf8'))
    expect(ownership).toMatchObject({ version: 2, generator: { name: 'openapi-to' } })
    expect(ownership.files).toHaveLength(3)

    const replay = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
    })
    expect(replay.isError).toBe(true)
    expect((structured(replay).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_ALREADY_USED')

    const check = await connected.client.callTool({ name: 'openapi_check_generation', arguments: { targets: ['main'] } })
    expect(structured(check)).toMatchObject({ success: true, outdated: false })
    const secondPrepare = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    expect((structured(secondPrepare).plan as { summary: Record<string, number> }).summary).toMatchObject({ added: 0, modified: 0, deleted: 0, unchanged: 3 })
    const secondPlan = structured(secondPrepare).plan as { planId: string; token: string; planHash: string }
    await writeFile(path.join(outputRoot, 'client.txt'), 'changed client!!\n')
    const staleFile = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: secondPlan.planId, token: secondPlan.token, approvedPlanHash: secondPlan.planHash } })
    expect((structured(staleFile).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_FILE_CHANGED')
    expect(await readFile(path.join(outputRoot, 'client.txt'), 'utf8')).toBe('changed client!!\n')
    expect(connected.stderr.join('')).not.toContain(plan.token)
  })

  it('rejects stale source changes without writing the prepared output', async () => {
    const root = await fixtureWorkspace()
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    await writeFile(path.join(root, 'openapi.yaml'), `openapi: 3.1.0\ninfo: { title: Changed, version: "2" }\npaths: {}\n`)
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect(applied.isError).toBe(true)
    expect((structured(applied).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_SOURCE_CHANGED')
    await expect(access(path.join(root, '.OpenAPI/generated'))).rejects.toThrow()
  })

  it('distinguishes a changed local reference from a changed entry source', async () => {
    const root = await fixtureWorkspace()
    await writeFile(path.join(root, 'schema.yaml'), 'type: object\nproperties: { value: { type: string } }\n')
    await writeFile(path.join(root, 'openapi.yaml'), `openapi: 3.1.0
info: { title: Controlled Ref, version: "1" }
paths: {}
components:
  schemas:
    Value:
      $ref: ./schema.yaml
`)
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    await writeFile(path.join(root, 'schema.yaml'), 'type: object\nproperties: { value: { type: number } }\n')
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect((structured(applied).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_REFERENCE_CHANGED')
  })

  it('binds the prepared plan to the exact remote response bytes', async () => {
    let remoteDocument = 'openapi: 3.1.0\ninfo: { title: Remote One, version: "1" }\npaths: {}\n'
    const remote = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/yaml' })
      response.end(remoteDocument)
    })
    await new Promise<void>((resolve) => remote.listen(0, '127.0.0.1', resolve))
    try {
      const address = remote.address()
      if (!address || typeof address === 'string') throw new Error('Unable to bind remote fixture.')
      const root = await fixtureWorkspace()
      const configPath = path.join(root, '.OpenAPI/openapi.config.cjs')
      const config = await readFile(configPath, 'utf8')
      await writeFile(configPath, config.replace("input: { path: './openapi.yaml' }", `input: { path: 'http://127.0.0.1:${address.port}/openapi.yaml' }`))
      const connected = await connect(root, true, ['--allow-private-network', '--allow-host', '127.0.0.1'])
      clients.push(connected.client)
      const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
      const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
      remoteDocument = 'openapi: 3.1.0\ninfo: { title: Remote Two, version: "2" }\npaths: {}\n'
      const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
      expect((structured(applied).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_SOURCE_CHANGED')
      await expect(access(path.join(root, '.OpenAPI/generated/client.txt'))).rejects.toThrow()
    } finally {
      await new Promise<void>((resolve) => remote.close(() => resolve()))
    }
  })

  it('refuses to overwrite a user file that appears at a prepared added path', async () => {
    const root = await fixtureWorkspace()
    const outputRoot = path.join(root, '.OpenAPI/generated')
    await mkdir(outputRoot, { recursive: true })
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    await writeFile(path.join(outputRoot, 'client.txt'), 'user appeared\n')
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect((structured(applied).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_FILE_CHANGED')
    expect(await readFile(path.join(outputRoot, 'client.txt'), 'utf8')).toBe('user appeared\n')
  })

  it.runIf(process.platform !== 'win32')('fails closed when the prepared output root is replaced by a symlink', async () => {
    const root = await fixtureWorkspace()
    const outputRoot = path.join(root, '.OpenAPI/generated')
    const movedRoot = path.join(root, '.OpenAPI/generated-before-replacement')
    const outside = await mkdtemp(path.join(os.tmpdir(), 'openapi-mcp-output-replacement-'))
    await mkdir(outputRoot, { recursive: true })
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    await rename(outputRoot, movedRoot)
    await symlink(outside, outputRoot, 'dir')
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect((structured(applied).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_WRITE_RECOVERY_REQUIRED')
    await expect(access(path.join(outside, 'client.txt'))).rejects.toThrow()
  })

  it('does not consume a plan when Apply is cancelled while waiting for the shared output lock', async () => {
    const root = await fixtureWorkspace()
    const outputRoot = path.join(root, '.OpenAPI/generated')
    await mkdir(outputRoot, { recursive: true })
    const connected = await connect(root, true, ['--write-lock-wait-ms', '5000'])
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    const competingWriter = await acquireOutputWriteLock(outputRoot)
    const controller = new AbortController()
    const pending = connected.client.callTool(
      { name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } },
      undefined,
      { signal: controller.signal, timeout: 5_000 },
    )
    setTimeout(() => controller.abort(), 50).unref()
    await expect(pending).rejects.toThrow(/abort/i)
    await competingWriter.release()
    await new Promise((resolve) => setTimeout(resolve, 100))
    const retry = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect(structured(retry)).toMatchObject({ success: true, applied: true })
  })

  it('defers a real Client cancellation received after the commit critical section begins', async () => {
    const root = await fixtureWorkspace()
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.cjs'),
      `module.exports = {
  servers: [{ name: 'main', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } }],
  plugins: [{ name: 'commit-cancellation-fixture', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    for (let index = 0; index < 501; index += 1) ctx.addArtifact({ kind: 'text', path: root + '/file-' + String(index).padStart(4, '0') + '.txt', content: String(index) + '\\n' });
  } } }]
};
`,
    )
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool(
      { name: 'openapi_prepare_generation', arguments: { targets: ['main'] } },
      undefined,
      { timeout: 15_000 },
    )
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    const controller = new AbortController()
    const pending = connected.client.callTool(
      {
        name: 'openapi_apply_generation',
        arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
        _meta: { progressToken: 'commit-cancellation' },
      },
      undefined,
      {
        signal: controller.signal,
        timeout: 15_000,
        onprogress: (notification) => {
          if (notification.progress >= 90) controller.abort()
        },
      },
    )
    await expect(pending).rejects.toThrow(/abort/i)
    await waitForFile(path.join(root, '.OpenAPI/generated/.openapi-to-manifest.json'), 10_000)
    const check = await connected.client.callTool(
      { name: 'openapi_check_generation', arguments: { targets: ['main'] } },
      undefined,
      { timeout: 15_000 },
    )
    expect(structured(check)).toMatchObject({ success: true, outdated: false })
    const replay = await connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
    })
    expect((structured(replay).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_ALREADY_USED')
  }, 30_000)

  it('serializes an actual CLI generate process behind MCP Apply on the same output root', async () => {
    const root = await fixtureWorkspace()
    const configPath = path.join(root, '.OpenAPI/openapi.config.cjs')
    const config = await readFile(configPath, 'utf8')
    await writeFile(configPath, config.replace("buildStart(ctx) {", "async buildStart(ctx) { await new Promise((resolve) => setTimeout(resolve, 250));"))
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    const applying = connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } }, undefined, { timeout: 5_000 })
    await waitForFile(path.join(root, '.OpenAPI/generated/.openapi-to-write.lock'))
    const cli = runCliGenerate(root)
    expect(structured(await applying)).toMatchObject({ success: true, applied: true })
    const cliResult = await cli
    expect(cliResult.code, cliResult.stderr).toBe(0)
    expect(JSON.parse(cliResult.stdout)).toMatchObject({ success: true, mode: 'write' })
    expect(await readFile(path.join(root, '.OpenAPI/generated/client.txt'), 'utf8')).toBe('generated client\n')
  }, 15_000)

  it('serializes two Apply calls for one root and allows only the still-current plan to commit', async () => {
    const root = await fixtureWorkspace()
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await Promise.all([
      connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } }),
      connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } }),
    ])
    const plans = prepared.map((result) => structured(result).plan as { planId: string; token: string; planHash: string })
    const results = await Promise.all(plans.map((plan) => connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
    })))
    expect(results.filter((result) => structured(result).success === true)).toHaveLength(1)
    expect(results.filter((result) => result.isError === true)).toHaveLength(1)
    expect(await readFile(path.join(root, '.OpenAPI/generated/client.txt'), 'utf8')).toBe('generated client\n')
  })

  it('applies independently prepared targets with different output roots without mixing plans', async () => {
    const root = await fixtureWorkspace()
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.cjs'),
      `module.exports = {
  servers: [
    { name: 'first', input: { path: './openapi.yaml' }, output: { dir: 'generated-a', clean: true } },
    { name: 'second', input: { path: './openapi.yaml' }, output: { dir: 'generated-b', clean: true } }
  ],
  plugins: [{ name: 'independent-roots', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    ctx.addArtifact({ kind: 'text', path: root + '/client.txt', content: ctx.openapiToSingleConfig.name + '\\n' });
  } } }]
};
`,
    )
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await Promise.all(['first', 'second'].map((target) => connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: [target] } })))
    const plans = prepared.map((result) => structured(result).plan as { planId: string; token: string; planHash: string })
    const applied = await Promise.all(plans.map((plan) => connected.client.callTool({
      name: 'openapi_apply_generation',
      arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash },
    })))
    expect(applied.every((result) => structured(result).success === true)).toBe(true)
    expect(await readFile(path.join(root, '.OpenAPI/generated-a/client.txt'), 'utf8')).toBe('first\n')
    expect(await readFile(path.join(root, '.OpenAPI/generated-b/client.txt'), 'utf8')).toBe('second\n')
  })

  it('rejects expired and cross-Server plans', async () => {
    const root = await fixtureWorkspace()
    const first = await connect(root, true, ['--plan-ttl-ms', '1000'])
    const second = await connect(root, true)
    clients.push(first.client, second.client)
    const prepared = await first.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    let otherServer: Awaited<ReturnType<Client['callTool']>>
    try {
      otherServer = await second.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    } catch (error) {
      throw new Error(`Cross-Server call failed: ${String(error)}\nfirst stderr: ${first.stderr.join('')}\nsecond stderr: ${second.stderr.join('')}`)
    }
    expect((structured(otherServer).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_NOT_FOUND')
    await new Promise((resolve) => setTimeout(resolve, 1100))
    let expired: Awaited<ReturnType<Client['callTool']>>
    try {
      expired = await first.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    } catch (error) {
      throw new Error(`Expired-plan call failed: ${String(error)}\nfirst stderr: ${first.stderr.join('')}\nsecond stderr: ${second.stderr.join('')}`)
    }
    expect((structured(expired).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_EXPIRED')
  })

  it('rejects stale config and ownership manifest changes', async () => {
    const root = await fixtureWorkspace()
    const configPath = path.join(root, '.OpenAPI/openapi.config.cjs')
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string }
    const originalConfig = await readFile(configPath, 'utf8')
    await writeFile(configPath, `${originalConfig}\n`)
    const configChanged = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect((structured(configChanged).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_CONFIG_CHANGED')
    await writeFile(configPath, originalConfig)

    const fresh = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const freshPlan = structured(fresh).plan as { planId: string; token: string; planHash: string }
    await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: freshPlan.planId, token: freshPlan.token, approvedPlanHash: freshPlan.planHash } })
    const unchanged = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const unchangedPlan = structured(unchanged).plan as { planId: string; token: string; planHash: string }
    const ownershipPath = path.join(root, '.OpenAPI/generated/.openapi-to-manifest.json')
    await writeFile(ownershipPath, `${await readFile(ownershipPath, 'utf8')} `)
    const manifestChanged = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: unchangedPlan.planId, token: unchangedPlan.token, approvedPlanHash: unchangedPlan.planHash } })
    expect((structured(manifestChanged).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_PLAN_MANIFEST_CHANGED')
  })

  it('deletes only unchanged ownership-managed files and preserves unmanaged files', async () => {
    const root = await fixtureWorkspace()
    const outputRoot = path.join(root, '.OpenAPI/generated')
    await mkdir(outputRoot, { recursive: true })
    await writeFile(path.join(outputRoot, 'old-managed.txt'), 'old managed\n')
    await writeFile(path.join(outputRoot, 'user.txt'), 'user owned\n')
    await writeFile(path.join(outputRoot, '.openapi-to-manifest.json'), `${JSON.stringify({ version: 1, files: ['old-managed.txt'] }, null, 2)}\n`)
    const connected = await connect(root, true)
    clients.push(connected.client)
    const prepared = await connected.client.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['main'] } })
    const plan = structured(prepared).plan as { planId: string; token: string; planHash: string; summary: { deleted: number } }
    expect(plan.summary.deleted).toBe(1)
    expect(JSON.stringify(prepared.content)).toContain('managed file deletion')
    const applied = await connected.client.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } })
    expect(structured(applied)).toMatchObject({ success: true, applied: true, summary: { deleted: 1 } })
    await expect(access(path.join(outputRoot, 'old-managed.txt'))).rejects.toThrow()
    expect(await readFile(path.join(outputRoot, 'user.txt'), 'utf8')).toBe('user owned\n')
  })
})
