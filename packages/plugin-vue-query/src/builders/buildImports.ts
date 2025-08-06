import type { OperationWrapper } from '@openapi-to/core'
import { formatterModuleSpecifier } from '@openapi-to/core/utils'
import { getRelativePath } from '@openapi-to/core/utils'
import { compact, isEmpty, union } from 'lodash-es'
import { OpenAPIV3 } from 'openapi-types'
import { type ImportDeclarationStructure, StructureKind } from 'ts-morph'
import type { PluginConfig } from '../types.ts'
import HttpMethods = OpenAPIV3.HttpMethods

export function buildImports(filePath: string, operation: OperationWrapper, pluginConfig?: PluginConfig): Array<ImportDeclarationStructure> {
  const request = operation.accessor.operationRequest
  const operationType = operation.accessor.operationTSType

  const isMutation = operation.method !== HttpMethods.GET
  const isInfinite = operation.accessor.queryParameters.some((param) => param.name === pluginConfig?.infinite?.pageNumParam)
  const useQuery: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['useQuery','queryOptions'],
    moduleSpecifier: '@tanstack/vue-query',
  }

  const useQueryOptions : ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['UseQueryOptions'],
    isTypeOnly: true,
    moduleSpecifier: '@tanstack/vue-query',
  }

  const useMutation: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['useMutation'],
    moduleSpecifier: '@tanstack/vue-query',
  }




  const mutationConfiguration: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['UseMutationOptions'],
    isTypeOnly: true,
    moduleSpecifier: '@tanstack/vue-query',
  }

  const hasErrorConfig = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const errorConfig = {
    kind: StructureKind.ImportDeclaration,
    namedImports: pluginConfig?.responseErrorTypeImportDeclaration?.namedImports,
    isTypeOnly: true,
    moduleSpecifier: pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier || '',
  }

  return [
    ...(isMutation ? [useMutation, mutationConfiguration] : isInfinite ? [] : [useQuery,useQueryOptions]),

    ...[
      {
        kind: StructureKind.ImportDeclaration,
        isTypeOnly: true,
        namedImports: [
          operationType?.pathParams,
          operationType?.queryParams,
          operationType?.body,
          operationType?.responseSuccess,
          operationType?.responseError,
        ].filter(Boolean),
        moduleSpecifier: formatterModuleSpecifier(getRelativePath(filePath, operationType?.filePath || ''), pluginConfig?.importWithExtension),
      },
      {
        kind: StructureKind.ImportDeclaration,
        namedImports: [request?.requestName || ''],
        moduleSpecifier: formatterModuleSpecifier(getRelativePath(filePath, request?.filePath || ''), pluginConfig?.importWithExtension),
      },
    ],
    ...[ hasErrorConfig ? errorConfig : undefined],
  ] as Array<ImportDeclarationStructure>
}
