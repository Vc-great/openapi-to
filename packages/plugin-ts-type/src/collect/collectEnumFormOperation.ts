import { collectEnumsFromPathParameters, collectEnumsFromPathRequestBodies, collectEnumsFromPathResponses } from '@/collect/collectEnumsFromDocument.ts'
import type { OperationWrapper } from '@openapi-to/core'

export function collectEnumFormOperation(operation: OperationWrapper) {
  const responseTagEnums = []

  const statusCodes = operation.accessor.operation.getResponseStatusCodes()
  for (const statusCode of statusCodes) {
    const responses = operation.accessor.operation.getResponseAsJSONSchema(statusCode)

    const responseEnum = collectEnumsFromPathResponses(responses, operation.accessor.operationName)
    responseTagEnums.push(...responseEnum)
  }

  return [
    ...collectEnumsFromPathParameters(operation.accessor.parameters, operation.accessor.operationName),
    ...collectEnumsFromPathRequestBodies(operation.accessor.operation.getRequestBody(), operation.accessor.operationName),
    ...responseTagEnums,
  ]
}
