import type { Diagnostic } from './diagnostics.ts'

export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  ConfigError: 2,
  OpenAPIError: 3,
  InputError: 4,
  PluginError: 5,
  GeneratedOutputOutdated: 6,
  BreakingChanges: 7,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

export function exitCodeForDiagnostics(diagnostics: readonly Diagnostic[]): ExitCodeValue {
  const codes = new Set(diagnostics.filter((diagnostic) => diagnostic.severity === 'error').map((diagnostic) => diagnostic.code))
  if (codes.size === 0) return ExitCode.Success
  if ([...codes].some((code) => code === 'CONFIG_LOAD_FAILED' || code.startsWith('CONFIG_') || code.startsWith('OPENAPI_CONFIG_'))) return ExitCode.ConfigError
  if ([...codes].some((code) => code === 'PLUGIN_EXECUTION_FAILED' || code.startsWith('PLUGIN_'))) return ExitCode.PluginError
  if ([...codes].some((code) => code === 'GENERATED_OUTPUT_OUTDATED')) return ExitCode.GeneratedOutputOutdated
  if ([...codes].some((code) => code.startsWith('OPENAPI_'))) {
    return ExitCode.OpenAPIError
  }
  if ([...codes].some((code) => code.startsWith('REMOTE_') || code.startsWith('INPUT_'))) return ExitCode.InputError
  return ExitCode.GeneralError
}
