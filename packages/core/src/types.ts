import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { LogLevel } from "./utils";


export type PluginFactory<T> = (pluginConfig:T)=>(openapiToSingleConfig:OpenapiToSingleConfig,openapiDocument:OpenAPIDocument)=>void

export type OpenapiToConfigInput = {
  /**
   * Project name, which is used to output the name of the folder
   */
  name: string;
  /**
   * api document path
   */
  path: string;
};

/**
 * @private
 */
export type OpenapiToConfigPlugin = {
  buildStart: (
    config: OpenapiToSingleConfig,
    openapiDocument: OpenAPIDocument,
  ) => void;
  writeFileSync: (
    config: OpenapiToSingleConfig,
    openapiDocument: OpenAPIDocument,
  ) => void;
  buildEnd: (
    config: OpenapiToSingleConfig,
    openapiDocument: OpenAPIDocument,
  ) => void;
};

export type OpenapiToSingleConfig = {
  input: OpenapiToConfigInput;
  output?:string;
  plugins: Array<OpenapiToConfigPlugin>;
};

/**
 * @private
 */
export type OpenapiToConfig = {
  /** Array of OpenapiTo project to use.*/
  input: Array<OpenapiToConfigInput>;
  /**
   * Array of OpenapiTo plugins to use.
   * The plugin/package can forsee some options that you need to pass through.
   */
  plugins: Array<OpenapiToConfigPlugin>;
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
