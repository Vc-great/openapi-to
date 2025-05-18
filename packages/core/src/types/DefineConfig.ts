export type OpenapiToSingleConfig = {
  /**
   * Project name
   */
  name?: string
  root: string
  input: OpenapiToConfigSingleInput
  output: OpenapiToConfigSingleOutput
  plugins: Array<any>
}

export type OpenapiToConfigSingleInput = {
  /**
   * api document path
   */
  path: string
}

export type OpenapiToConfigSingleOutput = {
  /**
   * which is used to output the name of the folder
   */
  dir: string
}

export type OpenapiToConfigServer = {
  /**
   * Project name
   */
  name?: string
  input: OpenapiToConfigSingleInput
  output: OpenapiToConfigSingleOutput
}

/**
 * @private
 */
export type OpenapiToConfig = {
  /** Array of OpenapiTo project to use.*/
  servers: Array<OpenapiToConfigServer>
  /**
   * Array of OpenapiTo plugins to use.
   * The plugin/package can forsee some options that you need to pass through.
   */
  plugins: Array<any>
}
