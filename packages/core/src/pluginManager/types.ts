import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import type { SourceFile } from 'ts-morph'
import type { OpenAPIHelper } from '../OpenAPIContext/OpenAPIHelper.ts'

import type { ComponentsParameters, ComponentsRequestBodies, ComponentsResponses, HookTagObject, OperationWrapper } from '../OpenAPIContext/types.ts'
import type { PluginEnumType } from '../enums.ts'
import type { OpenAPIDocument, OpenapiToSingleConfig } from '../types'

export type PluginName = {
  name: string
}

export type PluginContext = {
  tsRequest?: SourceFile[]
  tsType?: SourceFile[]
  zod?: SourceFile[]
}

export type WriteFile = Array<{
  filePath: string
  fileText: string
}>

export type PluginConfigFactory<T> = (pluginConfig?: T) => PluginDefinition

export interface HookContext extends PluginContext {
  _tagSourceFiles: Map<(string | undefined)[], SourceFile>
  getSourceFiles: (name: string[]) => SourceFile | undefined
  setSourceFiles: (name: string[], files: SourceFile) => void
  openapiHelper: OpenAPIHelper
  pluginNames: PluginEnumType
  openAPIDocument: OpenAPIDocument
  openapiToSingleConfig: OpenapiToSingleConfig
  store: Map<any, any>
}
export type ComponentsSchemas =
  | {
      [p: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
    }
  | Record<string, OpenAPIV3_1.SchemaObject>

export type ComponentHooks = {
  componentsSchemas?(schemas: ComponentsSchemas, hookContext: HookContext): Promise<void> | void
  componentsParameters?(parameters: ComponentsParameters, hookContext: HookContext): Promise<void> | void
  componentsRequestBodies?(requestBodies: ComponentsRequestBodies, hookContext: HookContext): Promise<void> | void
  componentsResponses?(responses: ComponentsResponses, hookContext: HookContext): Promise<void> | void
}

export type ComponentHookType =
  | { type: 'componentsSchemas'; data: ComponentsSchemas | undefined }
  | { type: 'componentsParameters'; data: ComponentsParameters | undefined }
  | { type: 'componentsRequestBodies'; data: ComponentsRequestBodies | undefined }
  | { type: 'componentsResponses'; data: ComponentsResponses | undefined }

export type PluginDefinition = {
  name: string
  dependencies?: PluginEnumType
  hooks: {
    buildStart?(hookContext: HookContext): Promise<void> | void
    tagStart?(tagData: HookTagObject, hookContext: HookContext): Promise<void> | void
    operation?(operation: OperationWrapper, hookContext: HookContext): Promise<void> | void
    tagEnd?(tagData: HookTagObject, hookContext: HookContext): Promise<void> | void
    componentsSchemas?(schemas: ComponentsSchemas, hookContext: HookContext): Promise<void> | void
    componentsParameters?(parameters: ComponentsParameters, hookContext: HookContext): Promise<void> | void
    componentsRequestBodies?(requestBodies: ComponentsRequestBodies, hookContext: HookContext): Promise<void> | void
    componentsResponses?(responses: ComponentsResponses, hookContext: HookContext): Promise<void> | void
    buildEnd?(hookContext: HookContext): Promise<void> | void
  }
}
