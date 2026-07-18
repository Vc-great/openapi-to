import { isOpenapiOperationCancelled, type Diagnostic } from '@openapi-to/core'
import type { ToolExecutionContext } from './tools/context.ts'

export class McpToolError extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(code: string, message: string, hint?: string) {
    super(message)
    this.name = 'McpToolError'
    this.diagnostics = [{ code, severity: 'error', message, ...(hint ? { hint } : {}) }]
  }
}

export function safeExecutionDiagnostic(error: unknown, execution?: ToolExecutionContext): Diagnostic {
  if (error instanceof McpToolError && error.diagnostics[0]) return error.diagnostics[0]
  if (execution?.timedOut || error instanceof McpToolTimeoutError) {
    return { code: 'MCP_TOOL_TIMEOUT', severity: 'error', message: 'The MCP Server time limit expired before the tool completed.', hint: 'Narrow the request or ask the server operator to review the startup timeout policy.' }
  }
  if (execution?.signal.aborted || isOpenapiOperationCancelled(error) || error instanceof McpRequestCancelledError) {
    return { code: 'MCP_REQUEST_CANCELLED', severity: 'error', message: 'The MCP tool request was cancelled before it completed.' }
  }
  return {
    code: 'MCP_TOOL_EXECUTION_FAILED',
    severity: 'error',
    message: 'The MCP tool could not complete the requested operation.',
  }
}

export class McpRequestCancelledError extends Error {
  constructor() {
    super('MCP request cancelled.')
    this.name = 'McpRequestCancelledError'
  }
}

export class McpToolTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super('MCP tool timeout expired.')
    this.name = 'McpToolTimeoutError'
  }
}
