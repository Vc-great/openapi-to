import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const execFileAsync = promisify(execFile)
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageRoot, '../..')
const bin = path.join(packageRoot, 'bin/openapi-to-mcp.js')
const iterationsArg = process.argv.indexOf('--iterations')
const iterations = iterationsArg >= 0 ? Number(process.argv[iterationsArg + 1]) : 5
const check = process.argv.includes('--check')
if (!Number.isInteger(iterations) || iterations < 2 || iterations > 30) throw new Error('--iterations must be an integer from 2 to 30.')

const relative = (value) => path.relative(repositoryRoot, value).split(path.sep).join('/')
const fixtures = path.join(packageRoot, 'src/evaluation/fixtures')
const large = relative(path.join(fixtures, 'large/openapi.json'))
const medium = relative(path.join(fixtures, 'medium/openapi.json'))
const generationConfig = relative(path.join(fixtures, 'generation/openapi.config.cjs'))

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

function summary(values) {
  return { min: Math.min(...values), median: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) }
}

async function rssBytes(pid) {
  if (!pid) return null
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)])
    const kib = Number(stdout.trim())
    return Number.isFinite(kib) ? kib * 1024 : null
  } catch {
    return null
  }
}

async function connect(withConfig) {
  const stderr = []
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, '--workspace-root', repositoryRoot, '--log-format', 'json', '--log-level', 'info', ...(withConfig ? ['--config', generationConfig] : [])], stderr: 'pipe' })
  transport.stderr?.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
  const client = new Client({ name: 'openapi-to-benchmark', version: '1.0.0' })
  const started = performance.now()
  await client.connect(transport)
  return { client, transport, stderr, startupMs: performance.now() - started }
}

const measurements = {}
const startup = []
const toolsList = []
for (let index = 0; index < 3; index += 1) {
  const connected = await connect(false)
  startup.push(connected.startupMs)
  const started = performance.now()
  await connected.client.listTools()
  toolsList.push(performance.now() - started)
  await connected.client.close()
}
measurements.serverStartup = { timingMs: summary(startup) }
measurements.toolsList = { timingMs: summary(toolsList) }

const connected = await connect(true)
const cases = [
  ['validate', 'openapi_validate', { source: large }],
  ['inspect', 'openapi_inspect', { source: large, includeOperations: true }],
  ['diff', 'openapi_diff', { before: medium, after: large }],
  ['generateDryRun', 'openapi_generate_dry_run', { targets: ['evaluation'] }],
  ['check', 'openapi_check_generation', { targets: ['evaluation'] }],
]
for (const [id, name, argumentsValue] of cases) {
  const times = []
  const sizes = []
  const rss = []
  let diagnostics = 0
  let artifactsOrChanges = 0
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now()
    const result = await connected.client.callTool({ name, arguments: argumentsValue }, undefined, { timeout: 120_000 })
    times.push(performance.now() - started)
    const structured = result.structuredContent ?? {}
    sizes.push(Buffer.byteLength(JSON.stringify(structured)))
    diagnostics = structured.truncated?.totalDiagnostics ?? structured.diagnostics?.length ?? 0
    artifactsOrChanges = structured.truncated?.totalArtifacts ?? structured.truncated?.totalChanges ?? 0
    if (id === 'generateDryRun' && (structured.success !== true || artifactsOrChanges !== 250)) throw new Error('Generation benchmark did not produce the expected 250-artifact dry-run plan.')
    if (id === 'check' && (structured.outdated !== true || artifactsOrChanges !== 250)) throw new Error('Check benchmark did not report the expected 250 added artifacts.')
    const pid = connected.transport._process?.pid
    const sample = await rssBytes(pid)
    if (sample !== null) rss.push(sample)
  }
  measurements[id] = {
    timingMs: summary(times),
    structuredContentBytes: summary(sizes),
    peakRssBytesApprox: rss.length ? Math.max(...rss) : null,
    diagnostics,
    artifactsOrChanges,
  }
}
const stderrBytes = connected.stderr.reduce((total, chunk) => total + chunk.byteLength, 0)
await connected.client.close()

const report = {
  schemaVersion: 1,
  runtime: { nodeMajor: Number(process.versions.node.split('.')[0]), cpuTime: { available: false, reason: 'Portable child-process CPU accounting is not reliable across supported platforms.' } },
  corpus: { largeInputBytes: (await stat(path.join(fixtures, 'large/openapi.json'))).size, largeOperations: 700, largeSchemas: 301, generationOperations: 250 },
  iterations,
  measurements,
  stderrBytes,
}

if (check) {
  const baseline = JSON.parse(await readFile(path.join(packageRoot, 'src/evaluation/performance-baseline.json'), 'utf8'))
  const violations = []
  for (const [id, limit] of Object.entries(baseline.thresholds)) {
    const measured = measurements[id]
    if (!measured) continue
    if (measured.timingMs.p95 > limit.maxP95Ms) violations.push(`${id} p95 ${Math.round(measured.timingMs.p95)}ms exceeds ${limit.maxP95Ms}ms`)
    if (measured.structuredContentBytes?.max > limit.maxStructuredContentBytes) violations.push(`${id} output exceeds ${limit.maxStructuredContentBytes} bytes`)
    if (measured.peakRssBytesApprox && measured.peakRssBytesApprox > baseline.maxPeakRssBytesApprox) violations.push(`${id} RSS exceeds ${baseline.maxPeakRssBytesApprox} bytes`)
  }
  report.regressionCheck = { success: violations.length === 0, violations }
  if (violations.length) process.exitCode = 1
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
for (const [id, value] of Object.entries(measurements)) process.stderr.write(`${id}: median ${Math.round(value.timingMs.median)}ms, p95 ${Math.round(value.timingMs.p95)}ms${value.structuredContentBytes ? `, max output ${value.structuredContentBytes.max} bytes` : ''}\n`)
