import type { OperationWrapper } from '@openapi-to/core'
import { isEmpty } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import type { PluginConfig } from '../types.ts'
import { formatterQueryKeyName, formatterQueryKeyTypeName } from '../utils/formatterQueryKey.ts'

/**
 * 构建请求方法体
 * @param operation - 操作包装器
 * @param pluginConfig - 插件配置
 * @returns 生成的请求方法体字符串
 */
export function buildMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig): string {
  if (operation.accessor.queryParameters.some((x) => x.name === pluginConfig?.infinite?.pageNumParam)) {
    return infiniteMethodBody(operation, pluginConfig)
  }

  if (operation.method === OpenAPIV3.HttpMethods.GET) {
    return queryMethodBody(operation, pluginConfig)
  }

  return mutationMethodBody(operation, pluginConfig)
}

/**

 * @param operation
 * @param pluginConfig
 */
function infiniteMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {
  const hasResponseConfig = !isEmpty(pluginConfig?.responseConfigTypeImportDeclaration?.namedImports)
  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseConfigType = hasResponseConfig
    ? `${pluginConfig?.responseConfigTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseSuccess}>['data']`
    : operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  return `const { query: queryOptions, shouldFetch = true } = options ?? {}
  const queryKey = ${formatterQueryKeyName(operation)}(${operation.accessor.hasQueryParameters ? 'params' : ''})

  return useSWRInfinite<
  ${responseConfigType},
  ${responseErrorType}, 
  ${formatterQueryKeyTypeName(operation)}
>(
    shouldFetch ? queryKey : ()=>null,
    {
      fetcher: async (dynamicParams: ${operation.accessor.operationTSType?.queryParams}) => {
        return ${operation.accessor.operationRequest?.requestName}(dynamicParams)
      },
      ...queryOptions
    }
  )`
}

/**
 * 构建查询方法体
 * @param operation - 操作包装器
 * @param pluginConfig
 * @returns 生成的查询方法体字符串
 */
function queryMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {
  const hasResponseConfig = !isEmpty(pluginConfig?.responseConfigTypeImportDeclaration?.namedImports)
  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseConfigType = hasResponseConfig
    ? `${pluginConfig?.responseConfigTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseSuccess}>['data']`
    : operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  const pathParameters = operation.method === OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => x.name) : ''

  const params = [...pathParameters, operation.accessor.hasQueryParameters ? 'params' : '', operation.accessor.hasRequestBody ? 'data' : '']
    .filter(Boolean)
    .join(',')

  return `
    const { query: queryOptions, shouldFetch = true } = options ?? {}
    const queryKey = ${formatterQueryKeyName(operation)}(${[pathParameters, operation.accessor.hasQueryParameters ? 'params' : ''].filter(Boolean).join(',')})

    return useSWR<
  ${responseConfigType},
  ${responseErrorType}, 
  ${formatterQueryKeyTypeName(operation)} | null
 >(shouldFetch ? queryKey : null, {
        ...queryOptions,
        fetcher: async (${operation.method !== OpenAPIV3.HttpMethods.GET ? '' : `_url${operation.accessor.hasRequestBody ? ', { arg: data }' : ''}`}) => {
            return ${operation.accessor.operationRequest?.requestName}(${params});
        }
    })`
}

function mutationMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {
  const hasResponseConfig = !isEmpty(pluginConfig?.responseConfigTypeImportDeclaration?.namedImports)
  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseConfigType = hasResponseConfig
    ? `${pluginConfig?.responseConfigTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseSuccess}>['data']`
    : operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  const pathParameters = operation.method !== OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => x.name) : ''

  const params = [...pathParameters, operation.accessor.hasRequestBody ? 'data' : ''].filter(Boolean).join(',')

  return `
    const { mutation: mutationOptions, shouldFetch = true } = options ?? {}
    const mutationKey = ${formatterQueryKeyName(operation)}()

    return useSWRMutation<
  ${responseConfigType},
  ${responseErrorType}, 
${formatterQueryKeyTypeName(operation)} | null,
${operation.accessor.operationTSType?.body}
>(
  shouldFetch ? mutationKey : null,
  async (_url, { arg: data }) => {
    return ${operation.accessor.operationRequest?.requestName}(${params})
  },
  mutationOptions
)`
}
