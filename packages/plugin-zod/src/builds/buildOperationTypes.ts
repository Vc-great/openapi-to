import { buildOperationRequestBodyTypes, buildPathParamsTypes, buildQueryParamsSchemas } from '@/builds/operation'
import type { OperationWrapper } from '@openapi-to/core'
import type { StatementStructures } from 'ts-morph'
import { buildJsonResponseTypes } from './operation'

export function buildOperationTypes(operation: OperationWrapper): StatementStructures[] {
  const requestBodyTypes = buildOperationRequestBodyTypes(operation)
  const queryParamsTypes = buildQueryParamsSchemas(operation)
  const pathParamsTypes = buildPathParamsTypes(operation)
  return [
    ...(pathParamsTypes ? [pathParamsTypes] : []),
    ...(queryParamsTypes ? [queryParamsTypes] : []),
    ...(requestBodyTypes ? [requestBodyTypes] : []),
    ...buildJsonResponseTypes(operation),
  ]
}
