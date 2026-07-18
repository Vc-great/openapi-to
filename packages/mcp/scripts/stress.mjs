import { execFile } from 'node:child_process'
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
await callMany(10, 'openapi_generate_dry_run', { targets: ['evaluation'] })
await callMany(10, 'openapi_check_generation', { targets: ['evaluation'] })
await Promise.all(Array.from({ length: 20 }, () => client.callTool({ name: 'openapi_validate', arguments: { source: fixture } }, undefined, { timeout: 120_000 })))
const rssAfter = await rss()
await client.close()
const rssGrowthBytesApprox = rssBefore !== null && rssAfter !== null ? rssAfter - rssBefore : null
const success = rssGrowthBytesApprox === null || rssGrowthBytesApprox < 512 * 1024 * 1024
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, success, calls: { validate: 120, inspect: 100, diff: 50, dryRun: 10, check: 10 }, durationMs: Math.round(performance.now() - started), stderrBytes, rssBefore, rssAfter, rssGrowthBytesApprox })}\n`)
if (!success) process.exitCode = 1
