// strategies/TypeStrategyFactory.ts
import type { PluginConfig } from '../types'

import { TsStrategy } from './TsStrategy'
import { ZodStrategy } from './ZodStrategy'

export class TypeStrategyFactory {
  public static getStrategy(pluginConfig: PluginConfig): TypeStrategy {
    // 例如根据配置判断插件，默认支持 Zod 或 TypeScript 类型
    if (pluginConfig.useZod) {
      return new ZodStrategy()
    }
    return new TsStrategy()
  }
}
