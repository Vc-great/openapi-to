import { isEmpty } from 'lodash-es'
import { type ImportDeclarationStructure, StructureKind } from 'ts-morph'
import { type PluginConfig, RequestClientEnum } from '../types.ts'

export function buildImports(imports: ImportDeclarationStructure[], pluginConfig?: PluginConfig): Array<ImportDeclarationStructure> {
  const request: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    namedImports: ['request'],
    moduleSpecifier: pluginConfig?.requestImportDeclaration?.moduleSpecifier ?? '@/utils/request',
  }

  const requestConfig: ImportDeclarationStructure | undefined =
    !isEmpty(pluginConfig?.requestConfigTypeImportDeclaration) && pluginConfig?.requestConfigTypeImportDeclaration?.moduleSpecifier !== 'axios'
      ? {
          kind: StructureKind.ImportDeclaration,
          isTypeOnly: true,
          namedImports: pluginConfig?.requestConfigTypeImportDeclaration?.namedImports || [],
          moduleSpecifier: pluginConfig?.requestConfigTypeImportDeclaration?.moduleSpecifier || '',
        }
      : undefined

  const axiosType: ImportDeclarationStructure = {
    kind: StructureKind.ImportDeclaration,
    isTypeOnly: true,
    namedImports: ['AxiosResponse', 'AxiosRequestConfig'],
    moduleSpecifier: 'axios',
  }

  return [
    ...imports,
    ...(pluginConfig?.requestClient === RequestClientEnum.AXIOS ? [axiosType] : []),
    request,
    ...(requestConfig ? [requestConfig] : []),
  ] as Array<ImportDeclarationStructure>
}
