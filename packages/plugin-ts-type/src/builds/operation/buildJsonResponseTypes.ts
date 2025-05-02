import { buildDefaultSuccessType, buildResponseErrorType, operationResponseTemplate } from '@/templates/operationResponseTemplate.ts'
import { getResponseSuccessName } from '@/templates/operationTypeNameTemplate.ts'
import type { JsonResponseObject } from '@/types.ts'
import type { OperationWrapper } from '@openapi-to/core'
import { camelCase } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import type { StatementStructures } from 'ts-morph'
import HttpMethods = OpenAPIV3.HttpMethods

export function buildJsonResponseTypes(operation: OperationWrapper): StatementStructures[] {
  const responseName = getResponseSuccessName(operation)

  const allStatusCodes = operation.accessor.operation.getResponseStatusCodes?.() ?? []
  const successCodes = allStatusCodes.filter((code) => /^2\d{2}$|^300$/.test(code))
  const errorCodes = allStatusCodes.filter((code) => /^[3-5]\d{2}$/.test(code))

  const responseObjects: JsonResponseObject[] = [...successCodes, ...errorCodes]
    .map((code) => ({
      code,
      jsonSchema: operation.accessor.operation.getResponseAsJSONSchema?.(code)?.[0] ?? undefined,
    }))
    .filter((res) => !!res.jsonSchema)

  const responseTypes = responseObjects.map((res) => operationResponseTemplate(res, responseName))

  if (errorCodes.length > 0) {
    responseTypes.push(buildResponseErrorType(errorCodes, operation.accessor.operationName, responseObjects))
  }

  if (successCodes.length === 0 || responseObjects.length === 0) {
    responseTypes.push(buildDefaultSuccessType(responseName))
  }

  return responseTypes
}

// ---------------- Helper: 单个 Response 类型生成 ----------------
