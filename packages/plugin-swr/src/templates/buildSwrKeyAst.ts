import type { OperationAccessor } from '@openapi-to/core'
import { URLPath } from '@openapi-to/core/utils'
import _ from 'lodash'
import { upperFirst } from 'lodash-es'
import type { OpenAPIV3 } from 'openapi-types'
import { type OptionalKind, type ParameterDeclarationStructure, StructureKind, VariableDeclarationKind } from 'ts-morph'
import type { BuildSwrKeyAstParameters, SwrKeyAst } from '../builders/types.ts'

export function buildSwrKeyAst({ keyFunctionName, operationAccessor, isInfinite }: BuildSwrKeyAstParameters): SwrKeyAst {
  //todo 从request 过滤掉date参数
  const funcParameters = []

  const queryKey = operationAccessor.hasQueryParameters ? '...(params ? [params] : [])' : ''

  const keys = _.chain([] as string[])
    .concat(queryKey)
    .filter(Boolean)
    .join()
    .value()

  const url = new URLPath(operationAccessor.operation.path)

  const declaration = {
    leadingTrivia: '\n',
    kind: StructureKind.VariableStatement,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: keyFunctionName,
        initializer: isInfinite
          ? `(${funcParameters.join()}, shouldFetch = true) =>
    (pageIndex: number, previousPageData: ${this.responseDataType}) => {
        if (!shouldFetch) {
            return null
        }
        if (previousPageData && !previousPageData.length) return null

        return {
            ...params
        } as const
    }`
          : `(${funcParams.join()}) => [{url:${url.requestPath},method:'${operationAccessor.operation.method}'}${keys ? `,${keys}` : ''}] as const`,

        //   docs: [{ description: "" }],
      },
    ],
    isExported: true,
  }

  return {
    keyAst: {
      leadingTrivia: '\n',
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: keyFunctionName,
          initializer: declaration,
        },
      ],
      isExported: true,
    },
    keyTypeAst: {
      kind: StructureKind.TypeAlias,
      isExported: false,
      name: upperFirst(keyFunctionName),
      type: `ReturnType<typeof ${keyFunctionName}>`,
    },
  }
}
