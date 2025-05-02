import type { OperationWrapper } from '@openapi-to/core'
import { camelCase, head } from 'lodash-es'
import type { OpenAPIV3 } from 'openapi-types'
import type { OptionalKind, ParameterDeclarationStructure } from 'ts-morph'
import { type PluginConfig, RequestClientEnum } from '../types.ts'

export function buildMethodParameters(operation: OperationWrapper, pluginConfig?: PluginConfig): OptionalKind<ParameterDeclarationStructure>[] {
  const queryParameters: OptionalKind<ParameterDeclarationStructure> = {
    name: 'params',
    hasQuestionToken: operation.accessor.isQueryParametersOptional,
    type: operation.accessor.operationTSType?.queryParams,
  }

  const bodyDataParameters: OptionalKind<ParameterDeclarationStructure> = {
    name: 'data',
    type: operation.accessor.operationTSType?.body,
  }

  const pathParameters: OptionalKind<ParameterDeclarationStructure>[] = operation.accessor.parameters
    .filter((x) => x.in === 'path')
    .map((item: OpenAPIV3.ParameterObject) => {
      return {
        name: camelCase(item.name),
        type: `${operation.accessor.operationTSType?.pathParams || ''}['${camelCase(item.name)}']`,
      }
    })

  const axiosRequestConfigType = `Partial<AxiosRequestConfig${operation.accessor.hasRequestBody ? `<${operation.accessor.operationTSType?.body || ''}>` : ''}>`
  const requestConfigNamedImports = head(pluginConfig?.requestConfigTypeImportDeclaration?.namedImports)

  const commonRequestConfigType = requestConfigNamedImports ? `Partial<${requestConfigNamedImports}>` : 'unknown'

  const requestConfig = {
    name: 'requestConfig',
    hasQuestionToken: true,
    type: pluginConfig?.requestClient === RequestClientEnum.COMMON ? commonRequestConfigType : axiosRequestConfigType,
  }
  return [
    ...(operation.accessor.hasPathParameters ? pathParameters : []),
    ...(operation.accessor.hasRequestBody ? [bodyDataParameters] : []),
    ...(operation.accessor.hasQueryParameters ? [queryParameters] : []),
    requestConfig,
  ]
}
