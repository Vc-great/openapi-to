import type {PluginConfigFactory} from './types.ts'
export function createPlugin<T>(pluginConfigFactory:PluginConfigFactory<T>){
  return pluginConfigFactory
}

