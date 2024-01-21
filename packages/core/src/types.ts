import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { LogLevel } from "./utils";

export type OpenapiToConfigSingleInput = {
  /**
   * Project name, which is used to output the name of the folder
   */
  name: string;
  /**
   * api document path
   */
  path: string;
};

export type LifeCycle = {
  name:string
  buildStart: () => void;
  writeFile: () => void;
  buildEnd: () => void;
}

export type PluginConfigFactory<T> =( pluginConfig:T)=>PluginFactory

export type PluginFactory = ({
                                  openapiDocument,
                                  openapiToSingleConfig,
                                }: {
  openapiDocument:OpenAPIDocument,
  openapiToSingleConfig:OpenapiToSingleConfig,

})=> LifeCycle


export type OpenapiToSingleConfig = {
  input: OpenapiToConfigSingleInput;
  output?:string;
  plugins: Array<PluginFactory>;
};

/**
 * @private
 */
export type OpenapiToConfig = {
  /** Array of OpenapiTo project to use.*/
  input: Array<OpenapiToConfigSingleInput>;
  /**
   * Array of OpenapiTo plugins to use.
   * The plugin/package can forsee some options that you need to pass through.
   */
  plugins: Array<PluginFactory>;
};

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
  logLevel?: LogLevel;
};

export type PluginCache = Record<string, [number, unknown]>;

// null will mean clear the watcher for this key
export type TransformResult = string | null;

export type HttpMethod = `${OpenAPIV3.HttpMethods}`;

export type PathGroup = {
  path: string;
  method: HttpMethod;
  tag: string;
};

export type PathGroupByTag = {
  [k in string]: Array<PathGroup>;
};

export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document
