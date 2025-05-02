import type { JSONSchema4, JSONSchema6Definition, JSONSchema7Definition } from 'json-schema'
import type { HttpMethods, JSONSchema, TagObject } from 'oas/types'
export type { HttpMethods } from 'oas/types'
import type { SchemaObject } from 'oas/types'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { OperationAccessor } from './OperationAccessor.ts'

type TagName = string

export type OperationWrapper = {
  path: string
  method: HttpMethods
  tagName: string
  accessor: OperationAccessor
}

export type OperationsByTag = Record<TagName, OperationWrapper[]>

export type OperationsByTagValue = OperationsByTag[keyof OperationsByTag]

export type ComponentsSchema = SchemaObject | OpenAPIV3.ReferenceObject // | JSONSchema

export type ReferenceObject = OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject

export type PathParameters = OpenAPIV3.OperationObject['parameters'] | OpenAPIV3_1.OperationObject['parameters']

export type PathRequestBodies = OpenAPIV3.OperationObject['requestBody'] | OpenAPIV3_1.OperationObject['requestBody']

export type ComponentsParameters = NonNullable<OpenAPIV3.ComponentsObject['parameters'] | OpenAPIV3_1.ComponentsObject['parameters']>
export type ComponentsParameterValue = OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject | OpenAPIV3.ParameterObject

export type RequestBodyObject = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject

//export type ComponentsRequestBodies = NonNullable<OpenAPIV3.ComponentsObject['requestBodies'] | OpenAPIV3_1.ComponentsObject['requestBodies']>
export type ComponentsRequestBodies = Record<string, ReferenceObject | RequestBodyObject>

export type ComponentsResponses = NonNullable<OpenAPIV3.ComponentsObject['responses'] | OpenAPIV3_1.ComponentsObject['responses']>

export type ComponentsResponsesValue = OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject | OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject

export type HookTagObject = TagObject

export type ParameterObjectWithRef = OpenAPIV3.ParameterObject & { $ref?: string }

export type ParameterObject = OpenAPIV3.ParameterObject

export type MediaTypeObject = OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject

export type Schema =
  | OpenAPIV3.SchemaObject
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3_1.SchemaObject
  | OpenAPIV3_1.ReferenceObject
  | JSONSchema4
  | JSONSchema6Definition
  | JSONSchema7Definition
