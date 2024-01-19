import { getUniqueName } from '../../utils/getUniqueName.ts'

import type { CorePluginOptions } from '../../plugin.ts'
import type { OpenapiToPlugin, OpenapiToUserPlugin } from '../../types.ts'

const usedPluginNames: Record<string, number> = {}

export function pluginParser<TPlugin extends OpenapiToUserPlugin>(plugin: TPlugin, context: CorePluginOptions['api'] | undefined): OpenapiToPlugin {
  const key = [plugin.kind, plugin.name, getUniqueName(plugin.name, usedPluginNames).split(plugin.name).at(1)] as [
    typeof plugin.kind,
    typeof plugin.name,
    string,
  ]

  if (plugin.api && typeof plugin.api === 'function') {
    // eslint-disable-next-line @typescript-eslint/ban-types
    const api = (plugin.api as Function).call(context) as typeof plugin.api

    return {
      ...plugin,
      key,
      api,
    }
  }

  return {
    ...plugin,
    key,
  } as OpenapiToPlugin
}
