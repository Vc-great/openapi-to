import type { PluginConfigFactory, PluginDefinition } from './types.ts'

export function createPlugin<T>(pluginConfigFactory: PluginConfigFactory<T>): PluginConfigFactory<T> {
  return pluginConfigFactory
}
