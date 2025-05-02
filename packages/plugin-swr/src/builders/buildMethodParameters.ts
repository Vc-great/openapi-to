import type { OperationWrapper } from '@openapi-to/core'
import { camelCase } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import type { OptionalKind, ParameterDeclarationStructure } from 'ts-morph'
import type { PluginConfig } from '../types.ts'
import { formatterQueryKeyTypeName } from '../utils/formatterQueryKey.ts'

export function buildMethodParameters(operation: OperationWrapper, pluginConfig?: PluginConfig): OptionalKind<ParameterDeclarationStructure>[] {
  const queryParameters: OptionalKind<ParameterDeclarationStructure> = {
    name: 'params',
    hasQuestionToken: operation.accessor.isQueryParametersOptional,
    type: operation.accessor.operationTSType?.queryParams,
  }

  const pathParameters: OptionalKind<ParameterDeclarationStructure>[] = operation.accessor.pathParameters.map((item: OpenAPIV3.ParameterObject) => {
    return {
      name: camelCase(item.name),
      type: `${operation.accessor.operationTSType?.pathParams || ''}['${camelCase(item.name)}']`,
    }
  })

  const options: OptionalKind<ParameterDeclarationStructure> = {
    name: 'options?',
    type: `{
    query?: Parameters<typeof useSWR<${operation.accessor.operationTSType?.responseSuccess}, ${formatterQueryKeyTypeName(operation)} | null, any>>[2]
    shouldFetch?: boolean
    }`,
  }

  const mutationOptions: OptionalKind<ParameterDeclarationStructure> = {
    name: 'options?',
    type: `{
        mutation?: SWRMutationConfiguration<${operation.accessor.operationTSType?.responseSuccess},  ${operation.accessor.operationTSType?.responseError}, ${formatterQueryKeyTypeName(operation)} | null ${operation.accessor.operationTSType?.body ? `,${operation.accessor.operationTSType?.body}` : ',never'}>;
        shouldFetch?: boolean;
        }`,
  }

  const infiniteOptions: OptionalKind<ParameterDeclarationStructure> = {
    name: 'options?',
    type: `{
      query?: Parameters<typeof useSWRInfinite<${operation.accessor.operationTSType?.responseSuccess},${operation.accessor.operationTSType?.responseError}, ${formatterQueryKeyTypeName(operation)} | null, any>>[2]
      shouldFetch?: boolean
    }`,
  }

  return [
    ...(operation.accessor.hasPathParameters ? pathParameters : []),
    ...(operation.accessor.hasQueryParameters ? [queryParameters] : []),
    ...(operation.method !== OpenAPIV3.HttpMethods.GET
      ? [mutationOptions]
      : operation.accessor.queryParameters.some((x) => x.name === pluginConfig?.infinite?.pageNumParam)
        ? [infiniteOptions]
        : [options]),
  ]
}
