import type { OperationWrapper } from '@openapi-to/core'
import { head } from 'lodash-es'
import type { JSDocStructure, OptionalKind } from 'ts-morph'

export function jsDocTemplateFromMethod(operation: OperationWrapper): OptionalKind<JSDocStructure>[] {
  const tagObject = head(operation.accessor.operation.getTags())
  return [
    {
      tags: [
        {
          leadingTrivia: '\n',
          tagName: 'summary',
          text: operation.accessor.operation.getSummary(),
        },
        {
          tagName: 'description',
          text: operation.accessor.operation.getDescription(),
        },
      ].filter((x) => x.text),
    },
  ]
}
