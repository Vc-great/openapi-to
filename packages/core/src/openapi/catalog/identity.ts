import type { Diagnostic } from '../../diagnostics.ts'

export interface OperationIdentityInput {
  method: string
  path: string
  operationId?: string
  sourcePointer: string
}

export interface OperationIdentity extends OperationIdentityInput {
  operationKey: string
}

export function assignOperationIdentities(operations: OperationIdentityInput[], target?: string): { identities: OperationIdentity[]; diagnostics: Diagnostic[] } {
  const counts = new Map<string, number>()
  for (const operation of operations) {
    if (operation.operationId) counts.set(operation.operationId, (counts.get(operation.operationId) ?? 0) + 1)
  }
  const diagnostics: Diagnostic[] = []
  const identities = operations.map((operation) => {
    const fallback = `${operation.method} ${operation.path}`
    const operationId = operation.operationId
    const unique = operationId !== undefined && counts.get(operationId) === 1
    if (!operationId) {
      diagnostics.push({
        code: 'MISSING_OPERATION_ID',
        severity: 'warning',
        message: `${fallback} has no operationId${target ? ` in target ${target}` : ''}.`,
        location: { path: pointerPath(operation.sourcePointer) },
      })
    } else if (!unique) {
      diagnostics.push({
        code: 'DUPLICATE_OPERATION_ID',
        severity: 'warning',
        message: `operationId ${operation.operationId} is duplicated${target ? ` in target ${target}` : ''}.`,
        location: { path: pointerPath(operation.sourcePointer) },
      })
    }
    if (!unique) {
      diagnostics.push({
        code: 'OPERATION_KEY_FALLBACK_USED',
        severity: 'info',
        message: `${fallback} uses the method-and-path operation key.`,
        location: { path: pointerPath(operation.sourcePointer) },
      })
    }
    return { ...operation, operationKey: unique && operationId ? operationId : fallback }
  })
  return { identities, diagnostics }
}

function pointerPath(pointer: string): string[] {
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
}
