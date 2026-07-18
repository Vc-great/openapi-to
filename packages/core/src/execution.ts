import type { Diagnostic } from './diagnostics.ts'

export interface OpenapiExecutionOptions {
  /** Cancels only this compiler or generation invocation. */
  signal?: AbortSignal
}

export class OpenapiOperationCancelledError extends Error {
  readonly code = 'OPENAPI_OPERATION_CANCELLED'

  constructor() {
    super('The OpenAPI operation was cancelled.')
    this.name = 'OpenapiOperationCancelledError'
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OpenapiOperationCancelledError()
}

export function isOpenapiOperationCancelled(error: unknown): boolean {
  return error instanceof OpenapiOperationCancelledError
}

export function cancellationDiagnostic(): Diagnostic {
  return {
    code: 'OPENAPI_OPERATION_CANCELLED',
    severity: 'error',
    message: 'The OpenAPI operation was cancelled before it completed.',
  }
}
