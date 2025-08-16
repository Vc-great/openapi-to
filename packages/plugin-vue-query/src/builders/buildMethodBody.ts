import type { OperationWrapper } from '@openapi-to/core'
import { isEmpty } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import type {PluginConfig, RequiredPluginConfig} from '../types.ts'
import { formatterQueryKeyName, formatterQueryKeyTypeName } from '../utils/formatterQueryKey.ts'
import {getPathParameters} from "../utils/getPathParameters.ts";

/**
 * 构建请求方法体
 * @param operation - 操作包装器
 * @param pluginConfig - 插件配置
 * @returns 生成的请求方法体字符串
 */
export function buildMethodBody(operation: OperationWrapper, pluginConfig: RequiredPluginConfig): string {
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
function queryMethodBody(operation: OperationWrapper, pluginConfig: RequiredPluginConfig) {

  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const responseType =  operation.accessor.operationTSType?.responseSuccess

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError

  const pathParameters = operation.method === OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => `toValue(${x.name})`) : []

  const params = [
    ...pathParameters,
    operation.accessor.hasQueryParameters ? 'toValue(params)' : '',
    operation.accessor.hasRequestBody ? 'toValue(data)' : '',
    'requestConfig'
  ]
    .filter(Boolean)
    .join(',')

  const hasPlaceholderData = pluginConfig.placeholderData.pathInclude?.some(item=>{
    if (typeof item === 'string') {
      return operation.path.includes(item)
    }
      return item.test(operation.path)
  })

const placeholderData =  hasPlaceholderData?`placeholderData:${pluginConfig.placeholderData.value}`:''
  return `
    const { query: userQueryOptions,requestConfig={} } = options ?? {}
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
        },
        ${placeholderData}
     }),
      ...userQueryOptions
    })`
}

function mutationMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig) {

  const hasResponseError = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)

  const responseErrorType = hasResponseError
    ? `${pluginConfig?.responseErrorTypeImportDeclaration?.namedImports[0]}<${operation.accessor.operationTSType?.responseError}>`
    : operation.accessor.operationTSType?.responseError



  const params = [
    ...operation.method !== OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => `toValue(${x.name})`) : '',
    operation.accessor.hasRequestBody ? 'toValue(data)' : '',
    'requestConfig'
  ].filter(Boolean).join(',')
  const variables = [
    ...operation.method !== OpenAPIV3.HttpMethods.GET ? operation.accessor.pathParameters.map((x) => `${x.name}`) : '',
    operation.accessor.hasRequestBody ? 'data' : ''].filter(Boolean).join(',')


  return `
    const { mutation:mutationOptions={},requestConfig={} } = options ?? {}
    const mutationKey = ${formatterQueryKeyName(operation)}()
   
    return useMutation<
    TData,
    ${responseErrorType}, 
    TVariables,
    TContext
>({
  mutationKey,
  mutationFn :(${variables}) => {
    return ${operation.accessor.operationRequest?.requestName}(${params})
  },
  ...mutationOptions
})`
}
