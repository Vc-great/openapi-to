import type { Diagnostic } from '@openapi-to/core'

export function mapWorkspaceDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    if (diagnostic.code === 'LOCAL_SOURCE_OUTSIDE_ROOT') return { ...diagnostic, code: 'MCP_WORKSPACE_PATH_OUTSIDE_ROOT' }
    if (diagnostic.code === 'LOCAL_SOURCE_SYMLINK_ESCAPE') return { ...diagnostic, code: 'MCP_WORKSPACE_SYMLINK_ESCAPE' }
    return diagnostic
  })
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'] as const
