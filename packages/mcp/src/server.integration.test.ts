import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bin = path.join(repositoryRoot, 'packages/mcp/bin/openapi-to-mcp.js')

interface ConnectedClient {
  client: Client
  stderr: string[]
}

async function connect(workspaceRoot: string, configPath?: string): Promise<ConnectedClient> {
  const stderr: string[] = []
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin, '--workspace-root', workspaceRoot, ...(configPath ? ['--config', configPath] : [])],
    stderr: 'pipe',
  })
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  const client = new Client({ name: 'openapi-to-mcp-test', version: '1.0.0' })
  await client.connect(transport)
  return { client, stderr }
}

function structured(result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
  return result.structuredContent as Record<string, unknown>
}

describe.sequential('stdio MCP server', () => {
  const clients: Client[] = []
  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()))
  })

  it('initializes a no-config server with exactly three bounded analysis tools', async () => {
    const connected = await connect(repositoryRoot)
    clients.push(connected.client)
    const listed = await connected.client.listTools()
    expect(listed.tools.map(({ name }) => name)).toEqual(['openapi_validate', 'openapi_inspect', 'openapi_diff'])
    for (const tool of listed.tools) {
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.outputSchema?.type).toBe('object')
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true })
    }

    const yamlSource = 'packages/mcp/src/fixtures/valid.yaml'
    const [validate, concurrentValidate, inspect] = await Promise.all([
      connected.client.callTool({ name: 'openapi_validate', arguments: { source: yamlSource } }),
      connected.client.callTool({ name: 'openapi_validate', arguments: { source: yamlSource } }),
      connected.client.callTool({ name: 'openapi_inspect', arguments: { source: yamlSource, includeOperations: true } }),
    ])
    expect(validate.isError).not.toBe(true)
    expect(structured(validate)).toMatchObject({ schemaVersion: 1, tool: 'openapi_validate', success: true, source: yamlSource })
    expect(validate.content).toHaveLength(1)
    expect(structured(inspect)).toMatchObject({ success: true, inspection: { pathCount: 1, operationCount: 1, securitySchemes: ['bearer'] } })
    expect(JSON.stringify(concurrentValidate.structuredContent)).toBe(JSON.stringify(validate.structuredContent))

    const repeated = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: yamlSource } })
    expect(JSON.stringify(repeated.structuredContent)).toBe(JSON.stringify(validate.structuredContent))

    const json = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'packages/core/mock/openapiV3.json' } })
    expect(json.isError).not.toBe(true)
    const missingRef = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'packages/mcp/src/fixtures/missing-ref.yaml' } })
    expect((structured(missingRef).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('OPENAPI_REF_NOT_FOUND')
    const cycle = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'packages/mcp/src/fixtures/cycle.yaml' } })
    expect((structured(cycle).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('OPENAPI_REF_CYCLE')

    for (const source of ['packages/core/mock/swagger2.0.json', 'packages/core/mock/openapiV3.json', yamlSource, 'packages/core/src/openapi/fixtures/openapi-3.2.yaml']) {
      const versionInspection = await connected.client.callTool({ name: 'openapi_inspect', arguments: { source } })
      expect(versionInspection.isError).not.toBe(true)
      expect((structured(versionInspection).inspection as { openapiVersion: string }).openapiVersion).toMatch(/^(2\.0|3\.)/)
    }
    const externalInspection = await connected.client.callTool({ name: 'openapi_inspect', arguments: { source: 'packages/mcp/src/fixtures/external-ref.yaml' } })
    expect(structured(externalInspection)).toMatchObject({ success: true, inspection: { externalReferenceCount: 1 } })

    const diff = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: yamlSource, after: 'packages/mcp/src/fixtures/after.yaml' } })
    expect(structured(diff)).toMatchObject({ success: true, breaking: true, summary: { breaking: 1 } })
    expect(String(structured(diff).limitation)).toContain('不是完整的兼容性证明')
    const noChange = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: yamlSource, after: yamlSource } })
    expect(structured(noChange)).toMatchObject({ breaking: false, changes: [] })
    const nonBreaking = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: yamlSource, after: 'packages/mcp/src/fixtures/added.yaml' } })
    expect((structured(nonBreaking).changes as Array<{ classification: string }>).map(({ classification }) => classification)).toContain('non-breaking')
    const warning = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: 'packages/mcp/src/fixtures/warning-before.yaml', after: 'packages/mcp/src/fixtures/warning-after.yaml' } })
    expect((structured(warning).changes as Array<{ classification: string }>).map(({ classification }) => classification)).toContain('warning')
    const invalidDiff = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: 'packages/mcp/src/fixtures/invalid.yaml', after: yamlSource } })
    expect(invalidDiff.isError).toBe(true)
    const invalidAfterDiff = await connected.client.callTool({ name: 'openapi_diff', arguments: { before: yamlSource, after: 'packages/mcp/src/fixtures/invalid.yaml' } })
    expect(invalidAfterDiff.isError).toBe(true)

    const invalid = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'packages/mcp/src/fixtures/invalid.yaml' } })
    expect(invalid.isError).toBe(true)
    expect(structured(invalid)).toMatchObject({ success: false })
    expect((structured(invalid).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('OPENAPI_PARSE_FAILED')

    const openapi32 = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'packages/core/src/openapi/fixtures/openapi-3.2.yaml', failOnWarning: true } })
    expect(openapi32.isError).toBe(true)
    expect((structured(openapi32).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('OPENAPI_WARNINGS_AS_ERRORS')

    const remote = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 'http://127.0.0.1/spec.yaml', allowPrivateNetwork: true } })
    expect(remote.isError).toBe(true)
    expect((structured(remote).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('REMOTE_SOURCE_BLOCKED')

    const escaped = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: '../outside.yaml' } })
    expect(escaped.isError).toBe(true)
    expect((structured(escaped).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_WORKSPACE_PATH_OUTSIDE_ROOT')

    const invalidArguments = await connected.client.callTool({ name: 'openapi_validate', arguments: { source: 123 } })
    expect(invalidArguments.isError).toBe(true)
    expect(invalidArguments.structuredContent).toBeUndefined()
    expect(JSON.stringify(invalidArguments.content)).toContain('-32602')
  })

  it('registers generation tools only for fixed trusted config and preserves stdio integrity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-mcp-integration-'))
    await mkdir(path.join(root, '.OpenAPI'))
    const spec = `openapi: 3.1.0
info: { title: Generation, version: "1" }
paths:
  /ping:
    get:
      operationId: ping
      responses: { "200": { description: ok } }
`
    await writeFile(path.join(root, 'openapi.yaml'), spec)
    await writeFile(path.join(root, 'fail.yaml'), spec)
    await writeFile(path.join(root, 'conflict.yaml'), spec)
    await writeFile(path.join(root, 'escape.yaml'), spec)
    await writeFile(
      path.join(root, '.OpenAPI/openapi.config.js'),
      `let active = 0;
module.exports = {
  servers: [
    { name: 'main', input: { path: './openapi.yaml' }, output: { dir: 'generated', clean: true } },
    { name: 'second', input: { path: './openapi.yaml' }, output: { dir: 'second' } },
    { name: 'fail', input: { path: './fail.yaml' }, output: { dir: 'failed' } },
    { name: 'conflict', input: { path: './conflict.yaml' }, output: { dir: 'conflict' } },
    { name: 'escape', input: { path: './escape.yaml' }, output: { dir: '../../outside' } }
  ],
  plugins: [{ name: 'stdio-fixture', hooks: { async buildStart(ctx) {
    const name = ctx.openapiToSingleConfig.name;
    if (name === 'fail') throw new Error('fixture plugin failed');
    if (name === 'conflict') {
      ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/same.txt', content: 'one' });
      ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/same.txt', content: 'two' });
      return;
    }
    active += 1;
    if (active > 1) throw new Error('generation was not serialized');
    console.log('plugin output');
    await new Promise(resolve => setTimeout(resolve, 20));
    ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/hello.txt', content: 'hello\\n' });
    ctx.addArtifact({ kind: 'text', path: ctx.openapiToSingleConfig.output.dir + '/large.txt', content: 'x'.repeat(40000) });
    ctx.addArtifact({ kind: 'binary', path: ctx.openapiToSingleConfig.output.dir + '/blob.bin', content: new Uint8Array([0, 1, 2]) });
    active -= 1;
  } } }]
};
`,
    )

    const connected = await connect(root, '.OpenAPI/openapi.config.js')
    clients.push(connected.client)
    const listed = await connected.client.listTools()
    expect(listed.tools.map(({ name }) => name)).toEqual([
      'openapi_validate',
      'openapi_inspect',
      'openapi_diff',
      'openapi_generate_dry_run',
      'openapi_check_generation',
    ])

    const outputRoot = path.join(root, '.OpenAPI/generated')
    const ownership = path.join(outputRoot, '.openapi-to-manifest.json')
    const dryRun = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['main'], configPath: '../untrusted.js', allowPrivateNetwork: true } })
    expect(dryRun.isError).not.toBe(true)
    expect(structured(dryRun)).toMatchObject({ success: true, mode: 'dry-run', config: { path: '.OpenAPI/openapi.config.js', targets: ['main'] } })
    await expect(access(outputRoot)).rejects.toThrow()
    await expect(access(ownership)).rejects.toThrow()

    const multiple = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['second', 'main'] } })
    expect(structured(multiple)).toMatchObject({ success: true, config: { targets: ['main', 'second'] } })
    await expect(access(path.join(root, '.OpenAPI/second'))).rejects.toThrow()

    const preview = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['main'], includePreview: true } })
    const previewArtifacts = ((structured(preview).servers as Array<{ manifest: { artifacts: Array<Record<string, unknown>> } }>)[0]?.manifest.artifacts ?? [])
    expect(previewArtifacts.find(({ path }) => path === 'large.txt')).toMatchObject({ previewTruncated: true })
    expect(previewArtifacts.find(({ path }) => path === 'blob.bin')).not.toHaveProperty('preview')
    expect(connected.stderr.join('')).toContain('plugin output')

    const unknown = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['unknown'] } })
    expect(unknown.isError).toBe(true)
    expect((structured(unknown).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_UNKNOWN_TARGET')

    const failed = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['fail'] } })
    expect(failed.isError).toBe(true)
    const afterFailure = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['main'] } })
    expect(afterFailure.isError).not.toBe(true)

    const conflict = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['conflict'] } })
    expect(conflict.isError).toBe(true)
    expect((structured(conflict).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('ARTIFACT_PATH_CONFLICT')

    const outputEscape = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['escape'] } })
    expect(outputEscape.isError).toBe(true)
    expect((structured(outputEscape).diagnostics as Array<{ code: string }>).map(({ code }) => code)).toContain('MCP_WORKSPACE_PATH_OUTSIDE_ROOT')

    const concurrent = await Promise.all([
      connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: { targets: ['main'] } }),
      connected.client.callTool({ name: 'openapi_check_generation', arguments: { targets: ['main'] } }),
    ])
    expect(concurrent.every((result) => (structured(result).diagnostics as Array<{ cause?: string }>).every(({ cause }) => !cause?.includes('not serialized')))).toBe(true)

    await mkdir(outputRoot, { recursive: true })
    await writeFile(path.join(outputRoot, 'hello.txt'), 'hello\n')
    await writeFile(path.join(outputRoot, 'large.txt'), 'x'.repeat(40000))
    await writeFile(path.join(outputRoot, 'blob.bin'), new Uint8Array([0, 1, 2]))
    await writeFile(path.join(outputRoot, 'user.txt'), 'unmanaged')
    await writeFile(ownership, `${JSON.stringify({ version: 1, files: ['blob.bin', 'hello.txt', 'large.txt'] }, null, 2)}\n`)
    const ownershipBefore = await readFile(ownership, 'utf8')
    const current = await connected.client.callTool({ name: 'openapi_check_generation', arguments: { targets: ['main'] } })
    expect(current.isError).not.toBe(true)
    expect(structured(current)).toMatchObject({ success: true, outdated: false })

    await writeFile(path.join(outputRoot, 'hello.txt'), 'outdated')
    await rm(path.join(outputRoot, 'blob.bin'))
    await writeFile(path.join(outputRoot, 'old.txt'), 'managed old output')
    await writeFile(ownership, `${JSON.stringify({ version: 1, files: ['blob.bin', 'hello.txt', 'large.txt', 'old.txt'] }, null, 2)}\n`)
    const staleOwnership = await readFile(ownership, 'utf8')
    const outdated = await connected.client.callTool({ name: 'openapi_check_generation', arguments: { targets: ['main'] } })
    expect(outdated.isError).toBe(true)
    expect(structured(outdated)).toMatchObject({ success: false, outdated: true })
    const statuses = ((structured(outdated).servers as Array<{ changes: Array<{ status: string }> }>)[0]?.changes ?? []).map(({ status }) => status).sort()
    expect(statuses).toEqual(['added', 'deleted', 'modified'])
    expect(await readFile(path.join(outputRoot, 'hello.txt'), 'utf8')).toBe('outdated')
    expect(await readFile(path.join(outputRoot, 'user.txt'), 'utf8')).toBe('unmanaged')
    expect(await readFile(ownership, 'utf8')).toBe(staleOwnership)
    expect(ownershipBefore).not.toBe(staleOwnership)
  })

  it('keeps generation tools stable when a supplied startup config fails to load', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openapi-mcp-bad-config-'))
    await writeFile(path.join(root, 'bad.config.ts'), 'throw new Error("secret token=do-not-return")\n')
    const connected = await connect(root, 'bad.config.ts')
    clients.push(connected.client)
    expect((await connected.client.listTools()).tools).toHaveLength(5)
    const result = await connected.client.callTool({ name: 'openapi_generate_dry_run', arguments: {} })
    expect(result.isError).toBe(true)
    expect((structured(result).diagnostics as Array<{ code: string; message: string }>)).toEqual([
      expect.objectContaining({ code: 'MCP_CONFIG_LOAD_FAILED' }),
    ])
    expect(JSON.stringify(result)).not.toContain('do-not-return')
  })
})
