import { execFile } from 'node:child_process'
import { access, copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageRoot, '../..')
const bin = path.join(packageRoot, 'bin/openapi-to-mcp.js')
const fixture = 'packages/mcp/src/evaluation/fixtures/small/openapi-3.1.json'
const config = 'packages/mcp/src/evaluation/fixtures/generation/openapi.config.cjs'
const transport = new StdioClientTransport({ command: process.execPath, args: [bin, '--workspace-root', repositoryRoot, '--config', config, '--log-level', 'error'], stderr: 'pipe' })
let stderrBytes = 0
transport.stderr?.on('data', (chunk) => { stderrBytes += chunk.byteLength })
const client = new Client({ name: 'openapi-to-stress', version: '1.0.0' })
await client.connect(transport)
const execFileAsync = promisify(execFile)
const rss = async () => {
  const pid = transport._process?.pid
  if (!pid) return null
  try { return Number((await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)])).stdout.trim()) * 1024 } catch { return null }
}
const rssBefore = await rss()
const started = performance.now()
const callMany = async (count, name, argumentsValue) => {
  for (let index = 0; index < count; index += 1) {
    const result = await client.callTool({ name, arguments: argumentsValue }, undefined, { timeout: 120_000 })
    if (!result.structuredContent || (result.structuredContent.success === false && name !== 'openapi_check_generation')) throw new Error(`${name} failed at iteration ${index}.`)
  }
}
await callMany(100, 'openapi_validate', { source: fixture })
await callMany(100, 'openapi_inspect', { source: fixture })
await callMany(50, 'openapi_diff', { before: fixture, after: fixture })
await callMany(100, 'openapi_search_operations', { target: 'evaluation', query: 'enterprise resource 42', limit: 8 })
await callMany(50, 'openapi_get_operation', { target: 'evaluation', operationKey: 'getEnterpriseResource42', detail: 'contract' })
await callMany(10, 'openapi_generate_dry_run', { targets: ['evaluation'] })
await callMany(10, 'openapi_check_generation', { targets: ['evaluation'] })
await Promise.all(Array.from({ length: 20 }, () => client.callTool({ name: 'openapi_validate', arguments: { source: fixture } }, undefined, { timeout: 120_000 })))
const rssAfter = await rss()
await client.close()
const writeRoot = await mkdtemp(path.join(os.tmpdir(), 'openapi-to-write-stress-'))
let writeCalls = 0
try {
  await mkdir(path.join(writeRoot, '.OpenAPI'))
  await copyFile(path.join(repositoryRoot, 'packages/mcp/src/evaluation/fixtures/generation/openapi.json'), path.join(writeRoot, 'openapi.json'))
  await writeFile(path.join(writeRoot, '.OpenAPI/openapi.config.cjs'), `module.exports = {
  servers: [{ name: 'evaluation', input: { path: './openapi.json' }, output: { dir: 'generated', clean: true } }],
  plugins: [{ name: 'write-stress', hooks: { buildStart(ctx) {
    const root = ctx.openapiToSingleConfig.output.dir;
    ctx.addArtifact({ kind: 'text', path: root + '/client.txt', content: 'stable\\n' });
  } } }]
};
`)
  const writeTransport = new StdioClientTransport({ command: process.execPath, args: [bin, '--workspace-root', writeRoot, '--config', '.OpenAPI/openapi.config.cjs', '--allow-write', '--log-level', 'error'], stderr: 'pipe' })
  writeTransport.stderr?.on('data', (chunk) => { stderrBytes += chunk.byteLength })
  const writeClient = new Client({ name: 'openapi-to-write-stress', version: '1.0.0' })
  await writeClient.connect(writeTransport)
  try {
    for (let index = 0; index < 20; index += 1) {
      const prepared = await writeClient.callTool({ name: 'openapi_prepare_generation', arguments: { targets: ['evaluation'] } }, undefined, { timeout: 120_000 })
      const plan = prepared.structuredContent?.plan
      if (!plan) throw new Error(`Prepare failed at write stress iteration ${index}.`)
      const applied = await writeClient.callTool({ name: 'openapi_apply_generation', arguments: { planId: plan.planId, token: plan.token, approvedPlanHash: plan.planHash } }, undefined, { timeout: 120_000 })
      if (applied.structuredContent?.success !== true) throw new Error(`Apply failed at write stress iteration ${index}.`)
      writeCalls += 1
    }
  } finally {
    await writeClient.close()
  }
  for (const internal of ['.openapi-to-write.lock', '.openapi-to-transaction.json', '.openapi-to-transaction']) {
    try {
      await access(path.join(writeRoot, '.OpenAPI/generated', internal))
      throw new Error(`Controlled-write stress leaked ${internal}.`)
    } catch (error) {
      if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error
    }
  }
} finally {
  await rm(writeRoot, { recursive: true, force: true })
}
const rssGrowthBytesApprox = rssBefore !== null && rssAfter !== null ? rssAfter - rssBefore : null
const success = rssGrowthBytesApprox === null || rssGrowthBytesApprox < 512 * 1024 * 1024
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, success, calls: { validate: 120, inspect: 100, diff: 50, searchOperations: 100, getOperation: 50, dryRun: 10, check: 10, prepare: writeCalls, apply: writeCalls }, durationMs: Math.round(performance.now() - started), stderrBytes, rssBefore, rssAfter, rssGrowthBytesApprox })}\n`)
if (!success) process.exitCode = 1
