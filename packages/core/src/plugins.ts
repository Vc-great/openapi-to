import type { PluginConfigFactory } from "./types.ts";
export function createPlugin<T>(
  pluginConfigFactory: PluginConfigFactory<T>,
): PluginConfigFactory<T> {
  return pluginConfigFactory;
}
