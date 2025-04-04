import type { AST, OpenAPI, OpenapiToSingleConfig } from '@openapi-to/core'
import type Oas from 'oas'

export enum RequestTypeEnum {
  AXIOS = 'axios',
  COMMON = 'common',
}

export type RequestType = 'axios' | 'common'

export type PluginConfig = {
  createZodDecorator?: boolean
  compare?: boolean
  zodDecoratorImportDeclaration?: {
    moduleSpecifier: string
  }
  requestImportDeclaration?: {
    moduleSpecifier: string
  }
  requestConfigTypeImportDeclaration?: {
    namedImports: Array<string>
    moduleSpecifier: string
  }
  requestType?: RequestType
}

export type Config = {
  oas: Oas
  openapi: OpenAPI
  ast: AST
  pluginConfig: PluginConfig | undefined
  openapiToSingleConfig: OpenapiToSingleConfig
}
