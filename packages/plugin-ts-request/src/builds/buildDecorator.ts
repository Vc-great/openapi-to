import type { OperationWrapper } from '@openapi-to/core'
import type { DecoratorStructure, OptionalKind } from 'ts-morph'

export function buildDecorator(operation: OperationWrapper): OptionalKind<DecoratorStructure>[] {
  return [
    {
      name: 'validateSchema',
    },
    {
      name: 'responseSchema',
      arguments: [operation.accessor.operationZodSchema?.responseSuccess || ''],
    },
  ]
}
