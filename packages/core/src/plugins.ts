import type {PluginFactory } from './types.ts'
export function createPlugin<T>(pluginFactory:PluginFactory<T>){
  return pluginFactory
}
