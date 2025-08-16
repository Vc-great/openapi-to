import { map as _map, camelCase, filter, head, isBoolean, some } from 'lodash-es'

import type { Operation } from 'oas/operation'
import { findSchemaDefinition } from 'oas/utils'
import type { ParameterObject, ParameterObjectWithRef, ReferenceObject } from './types.ts'

type OperationTSType = {
  pathParams: string | undefined
  queryParams: string | undefined
  body: string | undefined
  responseSuccess: string | undefined
  responseError: string | undefined
  filePath: string | undefined
}

type OperationZodSchema = {
  body: string
  responseSuccess: string
  filePath: string
}

type OperationRequest = {
  requestName: string
  filePath: string
}

export class OperationAccessor {
  private static _instances = new Map<string, OperationAccessor>()
  private _operationType: OperationTSType | undefined
  private _operationZodSchema: OperationZodSchema | undefined
  private _operationRequest: OperationRequest | undefined
  constructor(public operation: Operation) {}

  get operationName(): string {
    return camelCase(this.operationId) //|| fallbackOperationName(this.operation.path, this.operation.method)
  }

  get operationId() {
    return this.operation.getOperationId() || ''
  }

  get getFirstTagName(): string | undefined {
    return camelCase(head(_map(this.operation?.getTags(), 'name')))
  }
  get parameters(): ParameterObjectWithRef[] {
    const parameters = this.operation.getParameters() as (ReferenceObject | ParameterObject)[]
    return parameters.map((parameterObject) => {
      if (parameterObject && '$ref' in parameterObject && parameterObject.$ref) {
        return {
          ...findSchemaDefinition(parameterObject.$ref, this.operation?.api),
          $ref: parameterObject.$ref,
        }
      }
      return parameterObject
    })
  }

  get queryParameters(): ParameterObjectWithRef[] {
    return filter(this.parameters, ['in', 'query'])
  }

  get pathParameters(): ParameterObjectWithRef[] {
    return this.parameters
      .map((x) => {
        return {
          ...x,
          name: camelCase(x.name),
        }
      })
      .filter((x) => x.in === 'path')
  }

  get hasQueryParameters(): boolean {
    return some(this.parameters || [], ['in', 'query'])
  }

  get hasQueryParametersArray(): boolean {
    return some(this.parameters, (parameter) => 'schema' in parameter && parameter.schema && 'type' in parameter.schema && parameter.schema.type === 'array')
  }

  get hasPathParameters(): boolean {
    return some(this.parameters, ['in', 'path'])
  }

  get isQueryParametersOptional(): boolean {
    const queryParameters = this.queryParameters || []
    return queryParameters.every((x) => !x.required)
  }

  get hasRequestBody() {
    return this.operation.hasRequestBody()
  }

  get operationTSType(): OperationTSType | undefined {
    return this._operationType
  }

  get operationZodSchema() {
    return this._operationZodSchema
  }

  get operationRequest() {
    return this._operationRequest
  }

  setOperationTSType(operationTSType: OperationTSType) {
    this._operationType = operationTSType
  }

  setOperationZodSchemaName(operationZodSchema: OperationZodSchema) {
    this._operationZodSchema = operationZodSchema
  }

  setOperationRequest(operationRequest: OperationRequest) {
    this._operationRequest = operationRequest
  }

  /**
   * Content-type :application/json or Content-typec: *
   */
  get isJsonContainsDefaultCases(): boolean {
    const isJson = this.operation.isJson()
    //no set type.the default is json
    const isNoContentType = this.operation.getContentType() === '*/*'
    return isJson || isNoContentType
  }

  //todo isMultipart()

  //根据response的类型判断是否为下载的接口
  get isDownLoad(): boolean {
    // 检查响应内容类型是否为下载类型
    const responseContentType = this.getResponseContentType()
    const downloadTypes = [
      'application/octet-stream',
      'application/pdf',
      'application/zip',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'audio/mpeg',
      'video/mp4',
    ]
    return responseContentType.some((contentType) => downloadTypes.includes(contentType))
  }

  getResponseContentType(): string[] {
    const getResponseStatusCodes = head(this.operation.getResponseStatusCodes().filter((code) => code.startsWith('2')))
    const successResponse = this.operation.getResponseByStatusCode(200)
    if (!isBoolean(successResponse) && successResponse && 'content' in successResponse && successResponse.content) {
      // 获取第一个内容类型
      return Object.keys(successResponse.content)
    }
    return []
  }

  /**
   * 获取 OperationAccessor 实例
   * 如果相同 operation 的实例已存在则返回现有实例，否则创建新实例
   * @param operation Operation 对象
   * @returns OperationAccessor 实例
   */
  public static getInstance(operation: Operation): OperationAccessor {
    const operationId = `${operation.path}-${operation.method}`

    if (!OperationAccessor._instances.has(operationId)) {
      OperationAccessor._instances.set(operationId, new OperationAccessor(operation))
    }

    return OperationAccessor._instances.get(operationId)!
  }
}
