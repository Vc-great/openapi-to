import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageRoot, '../..')
const doctor = path.join(packageRoot, 'scripts/doctor.mjs')
const totalTimeoutMs = 180_000

function pnpmInvocation(args) {
  const entrypoint = process.env.npm_execpath
  if (entrypoint && /\.(?:c|m)?js$/i.test(entrypoint)) {
    return { command: process.execPath, args: [entrypoint, ...args] }
  }
  return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args }
}

function waitForChild(child, label, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timedOut = false
    let forceTimer
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      forceTimer = setTimeout(() => child.kill('SIGKILL'), 2_000)
      forceTimer.unref()
    }, timeoutMs)
    timer.unref()

    child.once('error', (error) => {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      reject(new Error(`${label} could not start: ${error.message}`))
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      if (timedOut) {
        reject(new Error(`${label} exceeded its ${timeoutMs} ms deadline.`))
        return
      }
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${label} failed${signal ? ` with ${signal}` : ` with exit code ${code ?? 'unknown'}`}.`))
    })
  })
}

async function run(command, args, label, { jsonMode = false } = {}) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    // Build output is operational detail. Keep it off stdout when Doctor emits JSON.
    stdio: jsonMode ? ['ignore', process.stderr, process.stderr] : 'inherit',
    windowsHide: true,
  })
  await waitForChild(child, label, totalTimeoutMs)
}

async function main() {
  const forwarded = process.argv.slice(2)
  const jsonMode = forwarded.includes('--json')
  const build = pnpmInvocation(['exec', 'turbo', 'run', 'build', '--filter=@openapi-to/mcp'])

  await run(
    build.command,
    build.args,
    '@openapi-to/mcp dependency-aware build',
    { jsonMode },
  )
  await run(process.execPath, [doctor, ...forwarded], 'MCP Doctor', { jsonMode: false })
}

main().catch((error) => {
  process.stderr.write(`[mcp-doctor] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
