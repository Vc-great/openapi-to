import { createPlugin, pluginEnum } from '@openapi-to/core'

import path from 'node:path'
import { kebabCase, upperFirst } from 'lodash-es'
import {OpenAPIV3} from "openapi-types";
import {Project, StructureKind, TypeParameterVariance} from 'ts-morph'
import {buildQueryGenericType} from "./builders/buildGenericType.ts";
import { buildImports } from './builders/buildImports.ts'
import { buildMethodBody } from './builders/buildMethodBody.ts'
import { buildMethodParameters } from './builders/buildMethodParameters.ts'
import { buildQueryKey, buildQueryKeyType } from './builders/buildQueryKey.ts'
import {buildTypeParameters} from "./builders/buildTypeParameters.ts";
import { jsDocTemplateFromMethod } from './templates/jsDocTemplateFromMethod.ts'
import type { PluginConfig } from './types.ts'
import HttpMethods = OpenAPIV3.HttpMethods
export const definePlugin = createPlugin<PluginConfig>((_pluginConfig) => {
  const project = new Project()
  const pluginConfig: PluginConfig = {
    ..._pluginConfig,
    responseErrorTypeImportDeclaration: {
      namedImports: _pluginConfig?.responseErrorTypeImportDeclaration?.namedImports ?? [],
      moduleSpecifier: _pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier ?? '',
    },
    importWithExtension: _pluginConfig?.importWithExtension ?? true,
  }
  return {
    name: pluginEnum.VueQuery,
    dependencies: [pluginEnum.TsType, pluginEnum.Request],
    hooks: {
      buildStart: async (ctx) => {
        // 可注入日志、校验 pluginConfig
        // ctx.logger.info('Request 插件启动', pluginConfig)
      },
      operation: async (operation, ctx) => {
        const hookName = `use${upperFirst(operation.accessor.operationName)}`

        const filePath = path.join(ctx.openapiToSingleConfig.output.dir, kebabCase(operation.tagName), `${kebabCase(hookName)}.query.ts`)
        const operationSourceFile = project.createSourceFile(filePath, '', { overwrite: true })

        operationSourceFile.addStatements(buildImports(filePath, operation, pluginConfig))

        operation.method === HttpMethods.GET && operationSourceFile.addStatements(buildQueryGenericType(operation))
        //key
        operationSourceFile.addStatements([buildQueryKey(operation, pluginConfig), buildQueryKeyType(operation)])

        operationSourceFile.addFunction({
          kind: StructureKind.Function,
          isAsync: false,
          name: hookName,
          typeParameters: buildTypeParameters(operation),
          parameters: buildMethodParameters(operation, pluginConfig),
          returnType: undefined,
          isExported: true,
          docs: jsDocTemplateFromMethod(operation),
          statements: buildMethodBody(operation, pluginConfig),
        })

        ctx.setSourceFiles([pluginEnum.SWR, operation.accessor.operationName], operationSourceFile)
      },
      tagEnd: async (tagData, ctx) => {},
      buildEnd() {},
    },
  }
})
