import path from 'node:path'
import { createPlugin, pluginEnum } from '@openapi-to/core'
import { getRelativePath } from '@openapi-to/core/utils'
import { type FunctionDeclarationStructure, type ImportDeclarationStructure, Project, StructureKind } from 'ts-morph'
import { buildImports } from './builds/buildImports.ts'
import { buildMethodBody } from './builds/buildMethodBody.ts'
import { buildMethodParameters } from './builds/buildMethodParameters.ts'
import { jsDocTemplateFromMethod } from './template/jsDocTemplateFromMethod.ts'
import type { PluginConfig } from './types.ts'

export const definePlugin = createPlugin<PluginConfig>((pluginConfig) => {
  const project = new Project()
  const dependencies = [...(pluginConfig?.parser === 'zod' ? [pluginEnum.Zod] : []), pluginEnum.TsType]
  return {
    dependencies: dependencies,
    name: pluginEnum.Request,
    hooks: {
      buildStart: async (ctx) => {
        // 可注入日志、校验 pluginConfig
        // ctx.logger.info('Request 插件启动', pluginConfig)
      },
      tagStart: async (tagData, ctx) => {},
      operation: async (operation, ctx) => {
        const requestName = `${operation.accessor.operationName}Service`
        const statement: FunctionDeclarationStructure = {
          kind: StructureKind.Function,
          isAsync: true,
          name: requestName,
          parameters: buildMethodParameters(operation, pluginConfig),
          returnType: undefined,
          isExported: true,
          docs: jsDocTemplateFromMethod(operation),
          statements: buildMethodBody(operation, pluginConfig),
        }
        const serviceFolderName = operation.accessor.getFirstTagName ?? ''
        const filePath = path.join(ctx.openapiToSingleConfig.output.dir, serviceFolderName, `${operation.accessor.operationName}.service.ts`)

        operation.accessor.setOperationRequest({
          filePath,
          requestName,
        })

        const operationSourceFile = project.createSourceFile(filePath, '', { overwrite: true })

        const operationType = operation.accessor.operationTSType
        const operationZodSchema = operation.accessor.operationZodSchema
        operationSourceFile.addStatements(
          buildImports(
            [
              {
                kind: StructureKind.ImportDeclaration,
                isTypeOnly: true,
                namedImports: [operationType?.pathParams, operationType?.queryParams, operationType?.body, operationType?.responseSuccess].filter(Boolean),
                moduleSpecifier: getRelativePath(filePath, operationType?.filePath || ''),
              },
              ...((pluginConfig?.parser === 'zod'
                ? [
                    {
                      kind: StructureKind.ImportDeclaration,
                      namedImports: [operationZodSchema?.body, operationZodSchema?.responseSuccess].filter(Boolean),
                      moduleSpecifier: getRelativePath(filePath, operationZodSchema?.filePath || ''),
                    },
                  ]
                : []) as Array<ImportDeclarationStructure>),
            ],
            pluginConfig,
          ),
        )
        operationSourceFile.addFunction(statement)
        ctx.setSourceFiles([pluginEnum.Request, operation.accessor.operationName], operationSourceFile)
      },
      tagEnd: async (tagData, ctx) => {
        // tagSourceFile.addModule(buildNamespaceType(tagData, allStatements))
        //todo imports zod
        /*  const zodSourceFile = ctx.getSourceFiles([pluginEnum.Zod, tagData.name])

        tagSourceFile.addStatements(buildImports(zodSourceFile, ctx, pluginConfig))*/
        /*  tagSourceFile.addStatements(buildImports(operationTypeOfTag, operationZodSchemaOfTag, pluginConfig))
        tagSourceFile.addClass({
          name: `${upperFirst(tagData.formattedTagName)}Service`,
          isExported: false,
          docs: [
            {
              leadingTrivia: '\n',
              description: `@tag ${tagData.name}\n${tagData.description || ''}`,
            },
          ],
          methods: allMethodStatements,
        })

        tagSourceFile.addVariableStatement({
          declarationKind: VariableDeclarationKind.Const,
          declarations: [
            {
              name: `${camelCase(tagData.formattedTagName)}Service`,
              initializer: `new ${upperFirst(tagData.formattedTagName)}Service`,
            },
          ],
          isExported: true,
        })*/
        // ctx.setSourceFiles([tagData.name], tagSourceFile)
      },
    },
  }
})
