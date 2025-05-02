import { collectRefsFromSchema } from '@/collect/collectRefsFromSchemas.ts'

import type { ComponentsParameters, ComponentsResponsesValue, ParameterObjectWithRef } from '@openapi-to/core'
import { isBoolean } from 'lodash-es'
import type { Operation } from 'oas/operation'
import type { MediaTypeObject } from 'oas/types'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

type Reference = OpenAPIV3.ReferenceObject

export function collectRefsFromOperationParameter(parameters: ParameterObjectWithRef[]) {
  const refs: Set<string> = new Set()
  parameters.forEach((parameter) => {
    if ('$ref' in parameter && parameter.$ref) {
      refs.add(parameter.$ref)
    }

    if (parameter.schema && '$ref' in parameter.schema) {
      refs.add(parameter.schema.$ref)
    } else if (parameter.schema) {
      collectRefsFromSchema(parameter.schema).forEach((ref) => refs.add(ref))
    }
  })
  return [...refs]
}

export function collectRefsFromOperationRequestBody(oasOperation: Operation) {
  const refs: Set<string> = new Set()
  const requestBody = oasOperation.schema.requestBody
  if (requestBody && '$ref' in requestBody && requestBody.$ref) {
    return [requestBody.$ref]
  }
  //
  const mediaTypeObject = oasOperation.getRequestBody()

  if (mediaTypeObject && !Array.isArray(mediaTypeObject) && !isBoolean(mediaTypeObject)) {
    if (mediaTypeObject.schema && '$ref' in mediaTypeObject.schema) {
      refs.add(mediaTypeObject.schema.$ref)
    } else if (mediaTypeObject.schema) {
      collectRefsFromSchema(mediaTypeObject.schema).forEach((ref) => refs.add(ref))
    }
  } else if (Array.isArray(mediaTypeObject)) {
    const [, media] = mediaTypeObject
    if (media?.schema) {
      collectRefsFromSchema(media.schema).forEach((ref) => refs.add(ref))
    }
  }
  return [...refs]
}

export function collectRefsFromOperationResponse(oasOperation: Operation) {
  const refs: Set<string> = new Set()
  const statusCodes = oasOperation.getResponseStatusCodes()
  for (const statusCode of statusCodes) {
    const responses = oasOperation.getResponseAsJSONSchema(statusCode)
    if (responses) {
      responses.forEach((response) => {
        collectRefsFromSchema(response.schema).forEach((ref) => refs.add(ref))
      })
    }
  }
  return [...refs]
}

export function collectRefsFromComponentParameters(parameters: ComponentsParameters): string[] {
  const refs: Set<string> = new Set()

  for (const parameter of Object.values(parameters)) {
    if ('$ref' in parameter) {
      refs.add(parameter.$ref)
    } else if (parameter.schema) {
      const $refs = collectRefsFromSchema(parameter.schema)
      $refs.forEach((ref) => refs.add(ref))
    }
  }

  return [...refs]
}

export function collectRefsFromComponentRequestBody(rb: OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject | Reference): string[] {
  const refs: Set<string> = new Set()

  if ('$ref' in rb) {
    refs.add(rb.$ref)
  } else {
    for (const media of Object.values(rb.content || {})) {
      if (media?.schema) {
        collectRefsFromSchema(media.schema).forEach((ref) => refs.add(ref))
      }
    }
  }

  return [...refs]
}

export function collectRefsFromComponentResponse(response: ComponentsResponsesValue) {
  const refs: Set<string> = new Set()

  // 处理直接是引用的情况
  if (response && '$ref' in response && response.$ref) {
    refs.add(response.$ref)
    return [...refs]
  }

  // 处理包含 content 的情况
  if (response && 'content' in response && response.content) {
    for (const media of Object.values(response.content)) {
      if (media?.schema) {
        if ('$ref' in media.schema) {
          refs.add(media.schema.$ref)
        } else {
          collectRefsFromSchema(media.schema).forEach((ref) => refs.add(ref))
        }
      }
    }
  }

  // 处理 headers 中可能的引用
  if (response && 'headers' in response && response.headers) {
    for (const header of Object.values(response.headers)) {
      if ('$ref' in header) {
        refs.add(header.$ref)
      } else if (header.schema) {
        if ('$ref' in header.schema) {
          refs.add(header.schema.$ref)
        } else {
          collectRefsFromSchema(header.schema).forEach((ref) => refs.add(ref))
        }
      }
    }
  }

  return [...refs]
}

//    const refType = `Component${upperFirst(getRefAlias(response.$ref))}ResponseModel`
//     refRegistry.add(refType)
