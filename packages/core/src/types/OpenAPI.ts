import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

export type HttpMethod = `${OpenAPIV3.HttpMethods}`

export type PathGroup = {
  path: string
  method: HttpMethod
  tag: string
}

export type PathGroupByTag = {
  [k in string]: Array<PathGroup>
}

export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document

export type OpenAPIAllDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document
