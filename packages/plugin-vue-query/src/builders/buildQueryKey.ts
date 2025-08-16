import type { OperationWrapper } from '@openapi-to/core'
import { URLPath } from '@openapi-to/core/utils'
import { camelCase } from 'lodash-es'

import { OpenAPIV3 } from 'openapi-types'
import { StructureKind, type TypeAliasDeclarationStructure, VariableDeclarationKind, type VariableStatementStructure } from 'ts-morph'
import type { PluginConfig } from '../types.ts'
import { formatterQueryKeyName, formatterQueryKeyTypeName } from '../utils/formatterQueryKey.ts'

export function buildQueryKey(operation: OperationWrapper, pluginConfig?: PluginConfig): VariableStatementStructure {
  const url = operation.method === OpenAPIV3.HttpMethods.GET ? new URLPath(<string>operation.accessor.operation.path).requestPath : `'${operation.path}'`
  const queryKeyName = formatterQueryKeyName(operation)

  const queryParameters = operation.accessor.hasQueryParameters ? `params?:MaybeRefOrGetter<${operation.accessor.operationTSType?.queryParams}>` : ''
  const pathParameters = operation.accessor.parameters
    .filter((x) => x.in === 'path')
    .map((item: OpenAPIV3.ParameterObject) => {
      const name = camelCase(item.name)
      const type = `${operation.accessor.operationTSType?.pathParams || ''}['${camelCase(item.name)}']`
      return `${name}:${type}`
    })

  const parameters = [...(operation.method === OpenAPIV3.HttpMethods.GET ? pathParameters : []), queryParameters].filter(Boolean)

  if (operation.accessor.queryParameters.some((x) => x.name === pluginConfig?.infinite?.pageNumParam)) {
    return {
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      docs: [],
      declarations: [
        {
          name: queryKeyName,
          type: '',
          initializer: ``,
        },
      ],
      isExported: true,
    }
  }

  return {
    leadingTrivia:'\n',
    kind: StructureKind.VariableStatement,
    declarationKind: VariableDeclarationKind.Const,
    docs: [],
    declarations: [
      {
        name: queryKeyName,
        type: '',
        initializer: `( ${parameters}) => [{ url:${url}, method: '${operation.method}'}${operation.accessor.hasQueryParameters ? ',...(params ? [params] : [])' : ''}] as const`,
      },
    ],
    isExported: true,
  }
}

export function buildQueryKeyType(operation: OperationWrapper): TypeAliasDeclarationStructure {
  return {
    leadingTrivia:'\n',
    kind: StructureKind.TypeAlias,
    name: formatterQueryKeyTypeName(operation),
    isExported: true,
    type: `ReturnType<typeof ${formatterQueryKeyName(operation)}>`,
    docs: [],
  }
}
