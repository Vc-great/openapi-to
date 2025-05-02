import type { OperationWrapper } from '@openapi-to/core'
import { URLPath } from '@openapi-to/core/utils'
import { type PluginConfig, type RequestClient, RequestClientEnum } from '../types.ts'

/**
 * 构建请求方法体
 * @param operation - 操作包装器
 * @param pluginConfig - 插件配置
 * @returns 生成的请求方法体字符串
 */
export function buildMethodBody(operation: OperationWrapper, pluginConfig?: PluginConfig): string {
  // 使用函数组合构建请求配置内容
  const requestFuncContent = buildRequestConfig(operation, pluginConfig)

  // 函数式策略模式 - 根据客户端类型处理请求
  return chooseClientStrategy(pluginConfig?.requestClient)(operation, requestFuncContent, pluginConfig)
}

/**
 * 构建请求配置
 */
function buildRequestConfig(operation: OperationWrapper, pluginConfig?: PluginConfig): string {
  const url = new URLPath(<string>operation.accessor.operation.path)
  const schemaName = operation.accessor.operationZodSchema?.body
  return [
    `method:'${operation.method.toUpperCase()}'`,
    buildHeader(operation),
    `url:${url.requestPath}`,
    operation.accessor.hasQueryParameters ? 'params' : '',
    operation.accessor.hasRequestBody ? (pluginConfig?.parser === 'zod' ? `data:${schemaName}.parse(data)` : 'data') : '',
    operation.accessor.isDownLoad ? "responseType:'blob'" : '',
    '...requestConfig',
    operation.accessor.hasQueryParametersArray ? buildParamsSerializer(operation, pluginConfig) : '',
  ]
    .filter(Boolean)
    .join(',\n')
}

/**
 * 构建请求头 - 纯函数
 */
const buildHeader = (operation: OperationWrapper): string =>
  operation.accessor.isJsonContainsDefaultCases
    ? ''
    : `headers:{
        'Content-Type':'${operation.accessor.operation.getContentType()}'
    }`

/**
 * 构建参数序列化器 - 纯函数
 */
const buildParamsSerializer = (operation: OperationWrapper, pluginConfig?: PluginConfig): string =>
  `paramsSerializer(params:${`${operation.accessor.operationTSType?.queryParams}`}) {
      return qs.stringify(params)
  }`

/**
 * 构建 Axios 类型注解 - 纯函数
 */
const buildAxiosTypeAnnotation = (operation: OperationWrapper, pluginConfig?: PluginConfig): string => {
  const requestData = operation.accessor.hasRequestBody ? operation.accessor.operationTSType?.body : undefined
  const responseConfigType = `AxiosResponse<${operation.accessor.operationTSType?.responseSuccess}${requestData ? `,${requestData}` : ''}>`

  return `<${operation.accessor.operationTSType?.responseSuccess},${responseConfigType}${requestData ? `,${requestData}` : ''}>`
}

/**
 * 通用客户端处理策略 - 纯函数
 */
const commonClientStrategy = (operation: OperationWrapper, requestFuncContent: string, pluginConfig?: PluginConfig): string =>
  `const res = await request<${operation.accessor.operationTSType?.responseSuccess}>({
     ${requestFuncContent}
  })
  ${pluginConfig?.parser === 'zod' ? `return { ...res, data: ${operation.accessor.operationZodSchema?.responseSuccess}.parse(res.data) }` : 'return res.data'}`

/**
 * Axios 客户端处理策略 - 纯函数
 */
const axiosClientStrategy = (operation: OperationWrapper, requestFuncContent: string, pluginConfig?: PluginConfig): string =>
  `const res = await request${buildAxiosTypeAnnotation(operation, pluginConfig)}({
     ${requestFuncContent}
  })
    ${pluginConfig?.parser === 'zod' ? `return { ...res, data: ${operation.accessor.operationZodSchema?.responseSuccess}.parse(res.data) }` : 'return res.data'}`

/**
 * 选择客户端策略 - 高阶函数实现策略模式
 */
const chooseClientStrategy = (clientType?: RequestClient) => (clientType === RequestClientEnum.COMMON ? commonClientStrategy : axiosClientStrategy)
