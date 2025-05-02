import type { OperationWrapper } from '@openapi-to/core'
import { lowerFirst } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import HttpMethods = OpenAPIV3.HttpMethods

export function getResponseSuccessName(operation: OperationWrapper) {
  const operationName = operation.accessor.operationName
  const isMutation = operation.accessor.operation.method !== HttpMethods.GET
  return `${operationName}${isMutation ? 'MutationSchema' : ''}ResponseSchema`
}

export function getQueryParamsTypeName(operationName: string) {
  return `${lowerFirst(operationName)}QueryParamsSchema`
}

export function getOperationPathParamsName(operationName: string) {
  return `${lowerFirst(operationName)}PathParamsSchema`
}

export function getRequestBodyTypeName(operationName: string) {
  return `${operationName}MutationRequestSchema`
}

export function getResponseErrorTypeName(operationName: string) {
  return `${operationName}ResponseErrorSchema`
}

export function getOperationZodSchemaName(operation: OperationWrapper) {
  const operationName = operation.accessor.operationName

  return {
    body: operation.accessor.hasRequestBody ? getRequestBodyTypeName(operationName) : '',
    responseSuccess: getResponseSuccessName(operation),
  }
}
