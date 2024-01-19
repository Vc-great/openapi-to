import { getDependedPlugins } from './validate.ts'

import type { OpenapiToPlugin } from '../../types.ts'

describe('PluginManager validate', () => {
  test('if validatePlugins works with 2 plugins', () => {
    expect(getDependedPlugins([{ name: 'pluginA' }, { name: 'pluginB' }, { name: 'pluginC' }] as OpenapiToPlugin[], 'pluginA')).toBeTruthy()
    expect(getDependedPlugins([{ name: 'pluginA' }, { name: 'pluginB' }, { name: 'pluginC' }] as OpenapiToPlugin[], 'pluginB')).toBeTruthy()
    expect(getDependedPlugins([{ name: 'pluginA' }, { name: 'pluginB' }, { name: 'pluginC' }] as OpenapiToPlugin[], ['pluginA', 'pluginC'])).toBeTruthy()
    try {
      getDependedPlugins([{ name: 'pluginA' }, { name: 'pluginB' }, { name: 'pluginC' }] as OpenapiToPlugin[], ['pluginA', 'pluginD'])
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
