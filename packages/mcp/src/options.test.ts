import { describe, expect, it } from 'vitest'
import { MAX_TOOL_TIMEOUT_MS, MIN_TOOL_TIMEOUT_MS, resolveMcpServerOptions } from './options.ts'

describe('MCP timeout options', () => {
  it('uses bounded startup-owned defaults', () => {
    expect(resolveMcpServerOptions({ workspaceRoot: process.cwd() }).timeouts).toEqual({ validateMs: 30_000, inspectMs: 30_000, diffMs: 45_000, generationMs: 60_000 })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 99.5, MAX_TOOL_TIMEOUT_MS + 1])('rejects unsafe timeout %s', (value) => {
    expect(() => resolveMcpServerOptions({ workspaceRoot: process.cwd(), timeouts: { validateMs: value } })).toThrow(/milliseconds/)
  })

  it('accepts the documented timeout boundaries', () => {
    expect(resolveMcpServerOptions({ workspaceRoot: process.cwd(), timeouts: { validateMs: MIN_TOOL_TIMEOUT_MS, generationMs: MAX_TOOL_TIMEOUT_MS } }).timeouts).toMatchObject({ validateMs: MIN_TOOL_TIMEOUT_MS, generationMs: MAX_TOOL_TIMEOUT_MS })
  })
})
