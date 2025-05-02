import { collectRefsFromOperationParameter, collectRefsFromOperationRequestBody, collectRefsFromOperationResponse } from '@/collect/collectRefsFromDocument.ts'
import type { OperationWrapper } from '@openapi-to/core'

export function collectRefsFromOperation(operation: OperationWrapper): string[] {
  // 收集响应中的引用

  const oasOperation = operation.accessor.operation

  return [
    ...new Set([
      ...collectRefsFromOperationParameter(operation.accessor.parameters),
      ...collectRefsFromOperationRequestBody(oasOperation),
      ...collectRefsFromOperationResponse(oasOperation),
    ]),
  ]
}
