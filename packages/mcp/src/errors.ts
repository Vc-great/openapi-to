import type { Diagnostic } from '@openapi-to/core'

export class McpToolError extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(code: string, message: string, hint?: string) {
    super(message)
    this.name = 'McpToolError'
    this.diagnostics = [{ code, severity: 'error', message, ...(hint ? { hint } : {}) }]
  }
}

export function safeExecutionDiagnostic(error: unknown): Diagnostic {
  if (error instanceof McpToolError && error.diagnostics[0]) return error.diagnostics[0]
  return {
    code: 'MCP_TOOL_EXECUTION_FAILED',
    severity: 'error',
    message: 'The MCP tool could not complete the requested operation.',
  }
}
