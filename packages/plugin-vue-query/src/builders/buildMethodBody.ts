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
    //todo: infinite query
    return ''
  }

  if (operation.method === OpenAPIV3.HttpMethods.GET) {
    return queryMethodBody(operation, pluginConfig)
  }

  return mutationMethodBody(operation, pluginConfig)
}



/**
 * 构建查询方法体
 * @param operation - 操作包装器
 * @param pluginConfig
 * @returns 生成的查询方法体字符串
 */
function queryMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {

  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseType =  operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  const pathParameters = operation.method === OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => x.name) : []

  const params = [...pathParameters, operation.accessor.hasQueryParameters ? 'params' : '', operation.accessor.hasRequestBody ? 'data' : '']
    .filter(Boolean)
    .join(',')

  return `
    const { query: userQueryOptions } = options ?? {}
    const queryKey = ${formatterQueryKeyName(operation)}(${[...pathParameters, operation.accessor.hasQueryParameters ? 'params' : ''].filter(Boolean).join(',')})

    return useQuery<
    TQueryFnData,
    ${responseErrorType},
    TData, 
    ${formatterQueryKeyTypeName(operation)} 
 >({
     ...queryOptions({
        queryKey,
        queryFn: async (${operation.method !== OpenAPIV3.HttpMethods.GET ? '{ signal }: { signal?: AbortSignal }' : `${operation.accessor.hasRequestBody ? 'data' : ''}`}) => {
            return ${operation.accessor.operationRequest?.requestName}(${params});
        }
     }),
      ...userQueryOptions
    })`
}

function mutationMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {

  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseType =  operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  const pathParameters = operation.method !== OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => x.name) : ''
  const bodyParameters = operation.accessor.hasRequestBody ? 'data' : ''
  const params = [...pathParameters, bodyParameters].filter(Boolean).join(',')

  return `
    const { mutation:mutationOptions={} } = options ?? {}
    const mutationKey = ${formatterQueryKeyName(operation)}()

    return useMutation<
    ${responseType},
    ${responseErrorType}, 
    ${operation.accessor.operationTSType?.body},
    TContext
>({
  mutationKey,
  mutationFn :(${bodyParameters}) => {
    return ${operation.accessor.operationRequest?.requestName}(${params})
  },
  ...mutationOptions
})`
}
