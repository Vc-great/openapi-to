import type { OpenAPIParameterObject } from '@openapi-to/core'
import type { OperationAccessor } from '@openapi-to/core'
import { map as _map, find, intersection } from 'lodash-es'

import { buildSwrKeyAst } from '../templates/buildSwrKeyAst.ts'
// builders/SwrKeyGenerator.ts
import type { TagContext } from '../types'
import type { KeyDefinition } from './types.ts'

export class SwrKeyGenerator {
  constructor(private tagContext: TagContext) {}

  isInfinite(parametersOfQuery: OpenAPIParameterObject[]) {
    const infiniteKey = this.tagContext.pluginConfig.infiniteKey || []
    const queryNames = _map(parametersOfQuery, 'name')
    return intersection(queryNames, infiniteKey).length > 0
  }

  getKeyFunctionName(operationAccessor: OperationAccessor): string {
    const operationName = this.tagContext.operations

    const conditions = [
      {
        cond: () => this.isInfinite(operationAccessor.parametersOfQuery),
        fn: () => `${operationName}InfiniteQueryKey`,
      },
      { cond: () => operationAccessor.operation.method === 'get', fn: () => `${operationName}QueryKey` },
      { cond: () => true, fn: () => `${operationName}MutationKey` },
    ]

    return find(conditions, (entry) => entry.cond())!.fn()
  }

  public generate(operationAccessor: OperationAccessor): KeyDefinition {
    const keyFunctionName = this.getKeyFunctionName(operationAccessor)
    return {
      keyFunctionName,
      sourceAst: buildSwrKeyAst({
        keyFunctionName: this.getKeyFunctionName(operationAccessor),
        operationAccessor,
        isInfinite: this.isInfinite(operationAccessor.parametersOfQuery),
      }),
      // 其它 key 信息
    }
  }
}
