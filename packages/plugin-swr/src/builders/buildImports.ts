import type { OperationWrapper } from '@openapi-to/core'
import { getRelativePath } from '@openapi-to/core/utils'
import { OpenAPIV3 } from 'openapi-types'
import { type ImportDeclarationStructure, StructureKind } from 'ts-morph'
import type { PluginConfig } from '../types.ts'
import HttpMethods = OpenAPIV3.HttpMethods

export function buildImports(filePath: string, operation: OperationWrapper, pluginConfig?: PluginConfig): Array<ImportDeclarationStructure> {
  const request = operation.accessor.operationRequest
  const operationType = operation.accessor.operationTSType

  const isMutation = operation.method !== HttpMethods.GET
  const isInfinite = operation.accessor.queryParameters.some((param) => param.name === pluginConfig?.infinite?.pageNumParam)
  const swr: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    defaultImport: 'useSWR',
    moduleSpecifier: 'swr',
  }

  const useSWRInfinite: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    defaultImport: 'useSWRInfinite',
    moduleSpecifier: 'swr/infinite',
  }

  const useSWRMutation: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    defaultImport: 'useSWRMutation',
    moduleSpecifier: 'swr/mutation',
  }

  const SWRMutationConfiguration: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['SWRMutationConfiguration'],
    isTypeOnly: true,
    moduleSpecifier: 'swr/mutation',
  }

  return [
    ...(isMutation ? [useSWRMutation, SWRMutationConfiguration] : isInfinite ? [useSWRInfinite] : [swr]),

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
        moduleSpecifier: getRelativePath(filePath, operationType?.filePath || ''),
      },
      {
        kind: StructureKind.ImportDeclaration,
        namedImports: [request?.requestName || ''],
        moduleSpecifier: getRelativePath(filePath, request?.filePath || ''),
      },
    ],
  ] as Array<ImportDeclarationStructure>
}
