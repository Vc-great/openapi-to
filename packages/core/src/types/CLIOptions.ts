//import type { LogLevel } from 'consola'

export type CLIOptions = {
  /**
   * Log level to report when using the CLI
   *
   * `silent` will hide all information that is not relevant
   *
   * `info` will show all information possible(not related to the PluginManager)
   *
   * `debug` will show all information possible(related to the PluginManager), handy for seeing logs
   * @default `silent`
   */
  logLevel?: 0 | 1 | 2 | 3 | 4 | 5 | (number & {})
}
