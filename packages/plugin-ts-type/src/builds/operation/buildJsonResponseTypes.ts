import { classifyResponseStatusCodes, type OperationWrapper } from '@openapi-to/core'
import type { StatementStructures } from 'ts-morph'
import { buildDefaultSuccessType, buildResponseErrorType, buildResponseUnionType, operationResponseTemplate } from '@/templates/operationResponseTemplate.ts'
import { getResponseStatusTypeName, getResponseSuccessName } from '@/templates/operationTypeNameTemplate.ts'
import type { JsonResponseObject } from '@/types.ts'

export function buildJsonResponseTypes(operation: OperationWrapper): StatementStructures[] {
  const responseName = getResponseSuccessName(operation)

  const documentedStatusCodes = Object.keys(operation.accessor.operation.schema?.responses ?? {})
  const allStatusCodes = documentedStatusCodes.length > 0 ? documentedStatusCodes : (operation.accessor.operation.getResponseStatusCodes?.() ?? [])
  const { success: successCodes, error: errorCodes } = classifyResponseStatusCodes(allStatusCodes)

  const responseObjects: JsonResponseObject[] = [...successCodes, ...errorCodes]
    .map((code) => {
      const sourceCode = allStatusCodes.find((status) => String(status).toLowerCase() === code.toLowerCase()) ?? code
      return {
        code,
        jsonSchema: operation.accessor.operation.getResponseAsJSONSchema?.(sourceCode)?.[0] ?? undefined,
      }
    })
    .filter((res) => !!res.jsonSchema)

  const availableSuccessCodes = successCodes.filter((code) => responseObjects.some((response) => response.code === code))
  const multipleSuccessResponses = availableSuccessCodes.length > 1
  const namedResponses = responseObjects.map((response) => ({
    ...response,
    name: successCodes.includes(response.code) && !multipleSuccessResponses ? responseName : getResponseStatusTypeName(responseName, response.code),
  }))
  const responseTypes = namedResponses.map(({ name, ...response }) => operationResponseTemplate(response, name))

  responseTypes.push(
    buildResponseErrorType(
      operation.accessor.operationName,
      namedResponses.filter(({ code }) => errorCodes.includes(code)).map(({ name }) => name),
    ),
  )

  if (multipleSuccessResponses) {
    responseTypes.push(
      buildResponseUnionType(
        responseName,
        namedResponses.filter(({ code }) => successCodes.includes(code)).map(({ name }) => name),
      ),
    )
  } else if (successCodes.length === 0 || availableSuccessCodes.length === 0) {
    responseTypes.push(buildDefaultSuccessType(responseName))
  }

  return responseTypes
}
