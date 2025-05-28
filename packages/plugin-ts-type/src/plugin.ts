import { buildEnum } from '@/builds/buildEnum.ts'
import { buildTypeImports } from '@/builds/buildTypeImports.ts'

import { buildComponentParameters } from '@/builds/components/buildComponentParameters.ts'
import { buildComponentsRequestBody } from '@/builds/components/buildComponentsRequestBody.ts'
import { buildComponentsResponse } from '@/builds/components/buildComponentsResponse.ts'
import type { SchemaDeclarationStructure } from '@/builds/components/buildSchemas.ts'
import { buildSchemas } from '@/builds/components/buildSchemas.ts'
import { collectEnumFormOperation } from '@/collect/collectEnumFormOperation.ts'
import {
  collectEnumsFromComponentParameters,
  collectEnumsFromComponentRequestBody,
  collectEnumsFromComponentSchema,
} from '@/collect/collectEnumsFromDocument.ts'
import { collectRefsFromComponentParameters, collectRefsFromComponentRequestBody, collectRefsFromComponentResponse } from '@/collect/collectRefsFromDocument.ts'
import { collectRefsFromOperation } from '@/collect/collectRefsFromOperation.ts'
import { collectRefsFromSchema } from '@/collect/collectRefsFromSchemas.ts'
import { getOperationTSTypeName } from '@/templates/operationTypeNameTemplate.ts'
import { formatterModuleSpecifier } from '@openapi-to/core/utils'

import path from 'node:path'
import { enumRegistry } from '@/EnumRegistry.ts'
import { getRefFilePath } from '@/utils/getRefFilePath.ts'
import { getUpperFirstRefAlias } from '@/utils/getUpperFirstRefAlias.ts'
import { createPlugin, pluginEnum } from '@openapi-to/core'
import { getRelativePath } from '@openapi-to/core/utils'
import { forEach, kebabCase, upperFirst } from 'lodash-es'
import { Project } from 'ts-morph'
import { buildOperationTypes } from './builds/buildOperationTypes.ts'
import type { PluginConfig } from './types.ts'

export const definePlugin = createPlugin((pluginConfig?: PluginConfig) => {
  const project = new Project()

  const operationFileNameOfTag: Set<string> = new Set()
  let componentFolderPath = ''
  return {
    name: pluginEnum.TsType,
    hooks: {
      buildStart: async (ctx) => {
        componentFolderPath = path.join(ctx.openapiToSingleConfig.output.dir, 'types')
      },
      tagStart: async (tagData, ctx) => {
        operationFileNameOfTag.clear()
      },
      operation: async (operation, ctx) => {
        const fileName = `${kebabCase(operation.accessor.operationName)}.types.ts`
        const filePath = path.join(ctx.openapiToSingleConfig.output.dir, kebabCase(operation.tagName), fileName)
        //`${ctx.openapiToSingleConfig.output.dir}${pluginConfig?.output.dir}/${lowerFirst(operation.formattedTagName)}/${fileName}.ts`
        operationFileNameOfTag.add(fileName)

        const operationEnums = collectEnumFormOperation(operation)

        enumRegistry.adds(operationEnums)

        const operationStatements = buildOperationTypes(operation)

        //保存类型名
        operation.accessor.setOperationTSType({
          ...getOperationTSTypeName(operation),
          filePath,
        })

        const operationSourceFile = project.createSourceFile(filePath, '', { overwrite: true })

        const imports = collectRefsFromOperation(operation).flatMap((ref) => {
          return buildTypeImports(
            [getUpperFirstRefAlias(ref)],
            formatterModuleSpecifier(getRelativePath(filePath, getRefFilePath(ref, componentFolderPath)), pluginConfig?.importWithExtension),
          )
        })
        operationSourceFile.addStatements(imports)

        const enumNames = operationEnums.map((item) => enumRegistry.getEnumValueName(item.enumValue, item.name))
        operationSourceFile.addStatements(buildTypeImports(enumNames, '../types/enum.model'))

        operationSourceFile.addStatements(operationStatements)
        ctx.setSourceFiles([pluginEnum.TsType, operation.tagName, operation.accessor.operationName], operationSourceFile)
      },
      tagEnd: async (tagData, ctx) => {
        /*       const folderPath = ctx.openapiToSingleConfig.output.dir
        const tagSourceFile = project.createSourceFile(`${folderPath}/${lowerFirst(tagData.name)}/index.ts`, '', { overwrite: true })

        tagSourceFile.addStatements(
          [...operationFileNameOfTag].map((fileName) => {
            return {
              kind: StructureKind.ExportDeclaration,
              isExported: true,
              isTypeOnly: true,
              moduleSpecifier: `./${fileName}`,
            }
          }),
        )
        ctx.setSourceFiles([pluginEnum.TsType, tagData.name], tagSourceFile)*/
      },
      componentsSchemas: async (schemas, ctx) => {
        for (const schemaName in schemas) {
          const schema = schemas[schemaName]!

          const formatterSchemaName = ctx.openapiHelper.formatterName(schemaName)

          const fileName = `${kebabCase(formatterSchemaName)}.model.ts`

          const filePath = path.join(ctx.openapiToSingleConfig.output.dir, 'types', 'models', fileName)

          const enums = collectEnumsFromComponentSchema(schema, formatterSchemaName)

          enumRegistry.adds(enums)

          const enumNames = enums.map((item) => enumRegistry.getEnumValueName(item.enumValue, item.name))

          const schemaSourceFile = project.createSourceFile(filePath, '', { overwrite: true })
          const statements: SchemaDeclarationStructure[] = buildSchemas(formatterSchemaName, schema)
          const refs = collectRefsFromSchema(schema)

          const imports = refs.flatMap((ref) => {
            return buildTypeImports(
              [getUpperFirstRefAlias(ref)],
              formatterModuleSpecifier(getRelativePath(filePath, getRefFilePath(ref, componentFolderPath)), pluginConfig?.importWithExtension),
            )
          })

          schemaSourceFile.addStatements(imports)

          schemaSourceFile.addStatements(buildTypeImports(enumNames, '../enum.model.ts'))
          schemaSourceFile.addStatements(statements)

          ctx.setSourceFiles([pluginEnum.TsType, 'componentsSchemas', schemaName], schemaSourceFile)
        }
      },
      componentsParameters(parameters, ctx) {
        enumRegistry.adds(collectEnumsFromComponentParameters(parameters))

        const refs = collectRefsFromComponentParameters(parameters)

        forEach(parameters, (parameter, parameterName) => {
          const formatterParameterName = ctx.openapiHelper.formatterName(parameterName)

          const fileName = `${kebabCase(formatterParameterName)}.model.ts`

          const filePath = path.join(componentFolderPath, 'parameters', fileName)
          const parameterSourceFile = project.createSourceFile(filePath, '', {
            overwrite: true,
          })
          const statements: SchemaDeclarationStructure | undefined = buildComponentParameters(parameter, formatterParameterName)
          if (statements) {
            const imports = refs.flatMap((ref) =>
              buildTypeImports(
                [getUpperFirstRefAlias(ref)],
                formatterModuleSpecifier(getRelativePath(filePath, getRefFilePath(ref, componentFolderPath)), pluginConfig?.importWithExtension),
              ),
            )

            parameterSourceFile.addStatements(imports)

            parameterSourceFile.addStatements([statements])

            ctx.setSourceFiles([pluginEnum.TsType, 'componentsParameters', parameterName], parameterSourceFile)
          }
        })
      },
      componentsRequestBodies(requestBodies, ctx) {
        // components.requestBodies
        for (const [requestBodyName, requestObject] of Object.entries(requestBodies)) {
          const formatterName = ctx.openapiHelper.formatterName(requestBodyName)
          enumRegistry.adds(collectEnumsFromComponentRequestBody(requestObject, formatterName))

          const refs = collectRefsFromComponentRequestBody(requestObject)

          const fileName = `${kebabCase(formatterName)}.model.ts`

          //
          const filePath = path.join(componentFolderPath, 'requestBodies', fileName)
          const requestBodySourceFile = project.createSourceFile(filePath, '', {
            overwrite: true,
          })
          const statements: SchemaDeclarationStructure | undefined = buildComponentsRequestBody(formatterName, requestObject)
          if (statements) {
            const imports = refs.flatMap((ref) =>
              buildTypeImports(
                [getUpperFirstRefAlias(ref)],
                formatterModuleSpecifier(getRelativePath(filePath, getRefFilePath(ref, componentFolderPath)), pluginConfig?.importWithExtension),
              ),
            )

            requestBodySourceFile.addStatements(imports)

            requestBodySourceFile.addStatements([statements])
            ctx.setSourceFiles([pluginEnum.TsType, 'componentsRequestBodies', requestBodyName], requestBodySourceFile)
          }
        }
      },
      componentsResponses(responses, ctx) {
        // components.responses
        forEach(responses, (response, responseName) => {
          const formatterResponse = ctx.openapiHelper.formatterName(responseName)

          enumRegistry.adds(collectEnumsFromComponentSchema(response, formatterResponse))

          const responseTypeName = `Response${upperFirst(formatterResponse)}`
          //todo responses
          const statements = buildComponentsResponse(response, responseTypeName)

          const refs = collectRefsFromComponentResponse(response)

          const fileName = `${kebabCase(formatterResponse)}.model.ts`

          const filePath = path.join(componentFolderPath, 'responses', fileName)

          const responseSourceFile = project.createSourceFile(filePath, '', {
            overwrite: true,
          })

          if (statements) {
            const imports = refs.flatMap((ref) =>
              buildTypeImports(
                [getUpperFirstRefAlias(ref)],
                formatterModuleSpecifier(getRelativePath(filePath, getRefFilePath(ref, componentFolderPath)), pluginConfig?.importWithExtension),
              ),
            )

            responseSourceFile.addStatements(imports)
            responseSourceFile.addStatements([statements])
            ctx.setSourceFiles([pluginEnum.TsType, 'componentsResponses', responseName], responseSourceFile)
          }
        })
      },
      buildEnd: async (ctx) => {
        const enumVariableStatements = buildEnum(enumRegistry.getAll())
        const filePath = path.join(componentFolderPath, formatterModuleSpecifier('enum.model.ts', pluginConfig?.importWithExtension))
        const enumSourceFile = project.createSourceFile(filePath, '', { overwrite: true })
        enumSourceFile.addStatements(enumVariableStatements)
        ctx.setSourceFiles([pluginEnum.TsType, 'enum.model'], enumSourceFile)
      },
    },
  }
})
