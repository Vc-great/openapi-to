import type { SourceFile } from 'ts-morph'
// templates/buildIndexAst.ts
import type { HookFile, TypeStrategy } from '../types'

export function buildIndexAst(hookFiles: HookFile[], strategy: TypeStrategy): SourceFile {
  // 1. 为所有 hook 文件生成 import 语句，如：\n
  //    import { useCreate, createMutationKey } from "./useCreate";
  // 2. 根据 hookFiles 提取各个 hook及 key 名称，构造：
  //    export namespace PetKey { ... }
  //    export const petSWRKey = { ... };
  //    export const petSWR = { ... };
  // 返回构造好的 SourceFile 对象
  throw new Error('未实现：buildIndexAst 模板函数')
}
