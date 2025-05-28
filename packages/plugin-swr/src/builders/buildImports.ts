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
  // response 和error 的moduleSpecifier是否相等
  const moduleSpecifierIsEqual =
    pluginConfig?.responseConfigTypeImportDeclaration?.moduleSpecifier === pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier

  const hasResponseConfig = !isEmpty(pluginConfig?.responseConfigTypeImportDeclaration?.namedImports)
  const responseConfig = {
    kind: StructureKind.ImportDeclaration,
    namedImports: pluginConfig?.responseConfigTypeImportDeclaration?.namedImports,
    isTypeOnly: true,
    moduleSpecifier: pluginConfig?.responseConfigTypeImportDeclaration?.moduleSpecifier || '',
  }
  const hasErrorConfig = !isEmpty(pluginConfig?.responseErrorTypeImportDeclaration?.namedImports)
  const errorConfig = {
    kind: StructureKind.ImportDeclaration,
    namedImports: pluginConfig?.responseErrorTypeImportDeclaration?.namedImports,
    isTypeOnly: true,
    moduleSpecifier: pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier || '',
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
        moduleSpecifier: formatterModuleSpecifier(getRelativePath(filePath, operationType?.filePath || ''), pluginConfig?.importWithExtension),
      },
      {
        kind: StructureKind.ImportDeclaration,
        namedImports: [request?.requestName || ''],
        moduleSpecifier: formatterModuleSpecifier(getRelativePath(filePath, request?.filePath || ''), pluginConfig?.importWithExtension),
      },
    ],
    ...(moduleSpecifierIsEqual
      ? [
          {
            kind: StructureKind.ImportDeclaration,
            namedImports: compact(
              union(pluginConfig?.responseConfigTypeImportDeclaration?.namedImports, pluginConfig?.responseErrorTypeImportDeclaration?.namedImports),
            ),
            isTypeOnly: true,
            moduleSpecifier: pluginConfig?.responseErrorTypeImportDeclaration?.moduleSpecifier || '',
          },
        ]
      : [hasResponseConfig ? responseConfig : undefined, hasErrorConfig ? errorConfig : undefined]),
  ] as Array<ImportDeclarationStructure>
}
