// strategies/TypeStrategy.ts
import _ from 'lodash'

export interface TypeStrategy {
  getNamespace(): string
  getTypeImport(): string
}

class TypeStrategy {
  constructor(private swrContext: SwrContext) {
    this.swrContext = swrContext
  }

  get typeNamespaceName(): string {
    return _.upperFirst(this.openapi.currentTagNameOfPinYin)
  }
}
