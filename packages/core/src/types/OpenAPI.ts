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

/**
 * A compatibility view for OpenAPI 3.2. The current upstream TypeScript model
 * stops at 3.1, so 3.2-only fields remain available without pretending they
 * are understood by generators.
 */
export type OpenAPIV3_2Document = Omit<OpenAPIV3_1.Document, 'openapi'> & {
  openapi: `3.2.${number}` | string
  $self?: string
  [key: string]: unknown
}

export type CompatibleOpenAPIDocument = OpenAPIDocument | OpenAPIV3_2Document

export type OpenAPIAllDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document | OpenAPIV3_2Document
