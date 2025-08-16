import type { OperationWrapper } from '@openapi-to/core'
import { camelCase } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import type { OptionalKind, ParameterDeclarationStructure } from 'ts-morph'
import type {PluginConfig, RequiredPluginConfig} from '../types.ts'
import { formatterQueryKeyTypeName } from '../utils/formatterQueryKey.ts'

export function buildMethodParameters(operation: OperationWrapper, pluginConfig: RequiredPluginConfig): OptionalKind<ParameterDeclarationStructure>[] {

  const requestConfigType = pluginConfig.requestConfigTypeImportDeclaration.namedImports[0]

  const queryParameters: OptionalKind<ParameterDeclarationStructure> = {
    name: 'params',
    hasQuestionToken: operation.accessor.isQueryParametersOptional,
    type: `MaybeRefOrGetter<${operation.accessor.operationTSType?.queryParams}>`,
  }

  const pathParameters: OptionalKind<ParameterDeclarationStructure>[] = operation.accessor.pathParameters.map((item: OpenAPIV3.ParameterObject) => {
    return {
      name: camelCase(item.name),
      type: `MaybeRefOrGetter<${operation.accessor.operationTSType?.pathParams || ''}['${camelCase(item.name)}']>`,
    }
  })

  const options: OptionalKind<ParameterDeclarationStructure> = {
    name: 'options?',
    type: `{
    requestConfig?: Partial<${requestConfigType}>
    query?: Partial<UseQueryOptions<
    TQueryFnData,
    ${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>,
    TData,
    TQueryData,
    ${formatterQueryKeyTypeName(operation)}
    >>
    }`,
  }

  const mutationOptions: OptionalKind<ParameterDeclarationStructure> = {
    name: 'options?',
    type: `{       
        requestConfig?: Partial<${requestConfigType}<${operation.accessor.operationTSType?.body||'never'}>>
        mutation?: UseMutationOptions<
        ${operation.accessor.operationTSType?.responseSuccess},  
        ${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>, 
        TVariables,
        TContext
 >;
        }`,
  }


  return [
    ...(operation.accessor.hasPathParameters ? pathParameters : []),
    ...(operation.accessor.hasQueryParameters ? [queryParameters] : []),
    ...(operation.method !== OpenAPIV3.HttpMethods.GET
      ? [mutationOptions]
      : operation.accessor.queryParameters.some((x) => x.name === pluginConfig?.infinite?.pageNumParam)
        ? []
        : [options]),
  ]
}
