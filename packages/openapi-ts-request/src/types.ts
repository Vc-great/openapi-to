export type PluginLifecycle = {
  /**
   * Resolve to a Path based on a baseName(example: `./Pet.ts`) and directory(example: `./models`).
   * Options can als be included.
   * @type hookFirst
   * @example ('./Pet.ts', './src/gen/') => '/src/gen/Pet.ts'
   */
  resolvePath?: () => {}

  resolveName?: () => {}

  buildStart?: () => {}
  buildEnd?: () => {}
  writeFile?: () => {}
}

export type PluginConfig = {
  createZodDecorator: boolean
}

export type PluginOptions = {
  createZodDecorator: boolean
}
