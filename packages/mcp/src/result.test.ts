import type { Diagnostic } from '@openapi-to/core'
import { describe, expect, it } from 'vitest'

import { createToolResult, truncateDiagnostics } from './result.ts'

describe('MCP result limits', () => {
  it('prioritizes errors and preserves total counts when diagnostics are truncated', () => {
    const diagnostics: Diagnostic[] = [
      { code: 'I', severity: 'info', message: 'info' },
      { code: 'W', severity: 'warning', message: 'warning' },
      { code: 'E', severity: 'error', message: 'error' },
    ]
    const result = truncateDiagnostics('/workspace', diagnostics, 2)
    expect(result.diagnostics.map(({ severity }) => severity)).toEqual(['error', 'warning'])
    expect(result.truncated).toMatchObject({ diagnostics: true, totalDiagnostics: 4, returnedDiagnostics: 2, omittedDiagnostics: 2 })
    expect(result.summary).toEqual({ errors: 1, warnings: 2, infos: 1 })
  })

  it('returns a structured execution error instead of an oversized result', () => {
    const result = createToolResult('test_tool', { success: true, value: 'x'.repeat(1000) }, 'large', {
      maxDiagnostics: 10,
      maxChanges: 10,
      maxArtifacts: 10,
      maxTextBytes: 100,
      maxPreviewBytes: 10,
    })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ success: false, diagnostics: [{ code: 'MCP_RESULT_TOO_LARGE' }] })
  })
})
