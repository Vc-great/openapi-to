import type { OperationWrapper } from '@openapi-to/core'
import { upperFirst } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'

export const formatterQueryKeyTypeName = (operation: OperationWrapper) =>
  `${upperFirst(operation.accessor.operationName)}${operation.method === OpenAPIV3.HttpMethods.GET ? 'Query' : 'Mutation'}Key`

export const formatterQueryKeyName = (operation: OperationWrapper) =>
  `${operation.accessor.operationName}${operation.method === OpenAPIV3.HttpMethods.GET ? 'Query' : 'Mutation'}Key`

//
