import type { PluginDefinition } from './types.ts'

export interface PluginContext {
  shared: Map<string, any>
  output(file: string, content: string): void
  log(msg: string): void
}

//拓扑排序阶段分组
export function sortPluginsByStages(plugins: PluginDefinition[]): PluginDefinition[][] {
  const nameToPlugin = new Map(plugins.map((p) => [p.name, p]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const stages: PluginDefinition[][] = []

  const tempStage: PluginDefinition[] = []

  function visit(name: string, stage: number) {
    if (visited.has(name)) return

    if (visiting.has(name)) {
      throw new Error(`Cyclic dependency detected in plugin: ${name}`)
    }

    visiting.add(name)
    const plugin = nameToPlugin.get(name)
    if (!plugin) throw new Error(`Plugin not found: ${name}`)

    const maxDepStage =
      plugin.dependencies?.reduce((max, dep) => {
        visit(dep, stage)
        return Math.max(max, findStage(dep))
      }, -1) ?? -1

    const targetStage = maxDepStage + 1

    if (!stages[targetStage]) stages[targetStage] = []
    stages[targetStage].push(plugin)

    visited.add(name)
    visiting.delete(name)
  }

  function findStage(name: string): number {
    for (let i = 0; i < stages.length; i++) {
      if (stages[i]!.some((p) => p.name === name)) return i
    }
    return -1
  }

  for (const plugin of plugins) {
    visit(plugin.name, 0)
  }

  return stages
}
