import type { JSONSchema4, JSONSchema6Definition, JSONSchema7Definition } from 'json-schema'
import type { JSONSchema } from 'oas/types'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

type MixedSchemaObject = Extract<OpenAPIV3_1.SchemaObject, { type?: (OpenAPIV3_1.ArraySchemaObjectType | OpenAPIV3_1.NonArraySchemaObjectType)[] }>

export type PluginConfig = {}

export type SchemaObjectAndJSONSchema =
  | OpenAPIV3.ArraySchemaObject
  | OpenAPIV3.NonArraySchemaObject
  | OpenAPIV3_1.ArraySchemaObject
  | OpenAPIV3_1.NonArraySchemaObject
  | MixedSchemaObject
  | JSONSchema
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3_1.ReferenceObject //| JSONSchema

export interface JsonResponseObject {
  code: string
  jsonSchema?: {
    description?: string
    label: string
    schema: any
    type: string | string[]
  }
}
