import { describe, expect, it } from 'vitest'
import { ExitCode, exitCodeForDiagnostics } from './exitCodes.ts'

describe('exit codes', () => {
  it.each([
    ['CONFIG_LOAD_FAILED', ExitCode.ConfigError],
    ['OPENAPI_PARSE_FAILED', ExitCode.OpenAPIError],
    ['INPUT_READ_FAILED', ExitCode.InputError],
    ['PLUGIN_EXECUTION_FAILED', ExitCode.PluginError],
    ['GENERATED_OUTPUT_OUTDATED', ExitCode.GeneratedOutputOutdated],
  ])('maps %s', (code, expected) => {
    expect(exitCodeForDiagnostics([{ code, severity: 'error', message: code }])).toBe(expected)
  })
})
