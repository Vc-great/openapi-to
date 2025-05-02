import type { TagContext } from '../types.ts'

import type { OperationAccessor } from '@openapi-to/core'
import type { TypeAliasDeclarationStructure, VariableStatementStructure } from 'ts-morph'
export type BuildSwrKeyAstParameters = {
  tagContext?: TagContext
  keyFunctionName: string
  operationAccessor: OperationAccessor
  isInfinite: boolean
}

export type SwrKeyAst = {
  keyAst: VariableStatementStructure
  keyTypeAst: TypeAliasDeclarationStructure
}

export interface KeyDefinition {
  keyFunctionName: string // key 的函数名称
  sourceAst: SwrKeyAst
}
