export type DiagnosticSeverity = 'info' | 'warning' | 'error'

export interface DiagnosticLocation {
  source?: string
  path?: Array<string | number>
  line?: number
  column?: number
}

export interface Diagnostic {
  code: string
  severity: DiagnosticSeverity
  message: string
  location?: DiagnosticLocation
  hint?: string
  plugin?: string
  cause?: string
}

export interface DiagnosticSummary {
  errors: number
  warnings: number
  infos: number
}

const severityOrder: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

function locationKey(diagnostic: Diagnostic): string {
  const location = diagnostic.location
  return [location?.source ?? '', ...(location?.path ?? []).map(String), location?.line ?? '', location?.column ?? ''].join('\u0000')
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((left, right) => {
    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      locationKey(left).localeCompare(locationKey(right)) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message) ||
      (left.plugin ?? '').localeCompare(right.plugin ?? '')
    )
  })
}

export function summarizeDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticSummary {
  return diagnostics.reduce<DiagnosticSummary>(
    (summary, diagnostic) => {
      if (diagnostic.severity === 'error') summary.errors += 1
      else if (diagnostic.severity === 'warning') summary.warnings += 1
      else summary.infos += 1
      return summary
    },
    { errors: 0, warnings: 0, infos: 0 },
  )
}

export function hasDiagnosticErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

export function errorCause(error: unknown, debug = false): string | undefined {
  if (error instanceof Error) return debug ? error.stack ?? error.message : error.message
  if (typeof error === 'string') return error
  return undefined
}

export class DiagnosticError extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(message: string, diagnostics: readonly Diagnostic[]) {
    super(message)
    this.name = 'DiagnosticError'
    this.diagnostics = sortDiagnostics(diagnostics)
  }
}
