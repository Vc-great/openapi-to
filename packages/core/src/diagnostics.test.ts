import { describe, expect, it } from 'vitest'
import { sortDiagnostics, summarizeDiagnostics } from './diagnostics.ts'

describe('diagnostics', () => {
  it('serializes and sorts deterministically', () => {
    const diagnostics = sortDiagnostics([
      { code: 'B', severity: 'warning', message: 'warning' },
      { code: 'A', severity: 'error', message: 'error', location: { source: 'api.yaml', path: ['info'] } },
    ])
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['A', 'B'])
    expect(JSON.parse(JSON.stringify(diagnostics))).toEqual(diagnostics)
    expect(summarizeDiagnostics(diagnostics)).toEqual({ errors: 1, warnings: 1, infos: 0 })
  })
})
