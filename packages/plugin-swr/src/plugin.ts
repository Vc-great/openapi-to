import { createPlugin, pluginEnum } from '@openapi-to/core'

import path from 'node:path'
import { kebabCase, upperFirst } from 'lodash-es'
import { Project, StructureKind } from 'ts-morph'
import { buildImports } from './builders/buildImports.ts'
import { buildMethodBody } from './builders/buildMethodBody.ts'
import { buildMethodParameters } from './builders/buildMethodParameters.ts'
import { buildQueryKey, buildQueryKeyType } from './builders/buildQueryKey.ts'
import { jsDocTemplateFromMethod } from './templates/jsDocTemplateFromMethod.ts'
import type { PluginConfig } from './types.ts'

export const definePlugin = createPlugin<PluginConfig>((_pluginConfig) => {
  const project = new Project()
  const pluginConfig: PluginConfig = {
    ..._pluginConfig,
    responseConfigTypeImportDeclaration: {
      namedImports: _pluginConfig?.responseConfigTypeImportDeclaration?.namedImports ?? ['AxiosResponse'],
      moduleSpecifier: _pluginConfig?.responseConfigTypeImportDeclaration?.moduleSpecifier ?? 'axios',
    },
    responseErrorTypeImportDeclaration: {
      namedImports: _pluginConfig?.responseErrorTypeImportDeclaration?.namedImports ?? ['AxiosError'],
      moduleSpecifier: _pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier ?? 'axios',
    },
    importWithExtension: _pluginConfig?.importWithExtension ?? true,
  }
  return {
    name: pluginEnum.SWR,
    dependencies: [pluginEnum.TsType, pluginEnum.Request],
    hooks: {
      buildStart: async (ctx) => {
        // 可注入日志、校验 pluginConfig
        // ctx.logger.info('Request 插件启动', pluginConfig)
      },
      operation: async (operation, ctx) => {
        const hookName = `use${upperFirst(operation.accessor.operationName)}`
        const folderName = operation.accessor.getFirstTagName ?? ''

        const filePath = path.join(ctx.openapiToSingleConfig.output.dir, folderName, `${kebabCase(hookName)}.swr.ts`)
        const operationSourceFile = project.createSourceFile(filePath, '', { overwrite: true })

        operationSourceFile.addStatements(buildImports(filePath, operation, pluginConfig))

        //key
        operationSourceFile.addStatements([buildQueryKey(operation, pluginConfig), buildQueryKeyType(operation)])

        operationSourceFile.addFunction({
          kind: StructureKind.Function,
          isAsync: false,
          name: hookName,
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
