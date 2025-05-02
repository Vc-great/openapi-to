import type { OperationWrapper } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import HttpMethods = OpenAPIV3.HttpMethods

export function getResponseSuccessName(operation: OperationWrapper) {
  const operationName = operation.accessor.operationName
  const isMutation = operation.accessor.operation.method !== HttpMethods.GET
  return `${upperFirst(operationName)}${isMutation ? 'Mutation' : ''}Response`
}

export function getQueryParamsTypeName(operationName: string) {
  return `${upperFirst(operationName)}QueryParams`
}

export function getOperationPathParamsName(operationName: string) {
  return `${upperFirst(operationName)}PathParams`
}

export function getRequestBodyTypeName(operationName: string) {
  return `${upperFirst(operationName)}MutationRequest`
}

export function getResponseErrorTypeName(operationName: string) {
  return `${upperFirst(operationName)}ResponseError`
}

export function getOperationTSTypeName(operation: OperationWrapper) {
  const operationName = operation.accessor.operationName

  return {
    pathParams: operation.accessor.hasPathParameters ? getOperationPathParamsName(operationName) : undefined,
    queryParams: operation.accessor.hasQueryParameters ? getQueryParamsTypeName(operationName) : undefined,
    body: operation.accessor.hasRequestBody ? getRequestBodyTypeName(operationName) : undefined,
    responseSuccess: getResponseSuccessName(operation),
    responseError: getResponseErrorTypeName(operationName),
  }
}
