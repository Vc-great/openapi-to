import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import type { LogLevel } from "./logger.ts";
export * from "./ast/type.ts";
export * from "./openapi/types.ts";

export type PluginName = {
  name: string;
};
export type PluginLifecycleHooks = keyof LifeCycle;

export type PluginContext = {};

export enum LifeCycleEnum {
  buildStart = "buildStart",
  writeFile = "writeFile",
  buildEnd = "buildEnd",
}

export type LifeCycle = {
  [LifeCycleEnum.buildStart]: (context: PluginContext) => void;
  /**
   * plugin lifeCycle return path
   */
  [LifeCycleEnum.writeFile]: (context: PluginContext) => string[];
  [LifeCycleEnum.buildEnd]: (context: PluginContext) => void;
};

export type PluginConfigFactory<T> = (pluginConfig?: T) => PluginFactory;

export type PluginFactory = ({
  openapiDocument,
  openapiToSingleConfig,
}: {
  openapiDocument: OpenAPIDocument;
  openapiToSingleConfig: OpenapiToSingleConfig;
}) => LifeCycle & PluginName;

export type OpenapiToSingleConfig = {
  /**
   * Project name
   */
  name?: string;
  input: OpenapiToConfigSingleInput;
  output: OpenapiToConfigSingleOutput;
  plugins: Array<PluginFactory>;
};

export type OpenapiToConfigSingleInput = {
  /**
   * api document path
   */
  path: string;
};

export type OpenapiToConfigSingleOutput = {
  /**
   * which is used to output the name of the folder
   */
  dir: string;
};

export type OpenapiToConfigServer = {
  /**
   * Project name
   */
  name?: string;
  input: OpenapiToConfigSingleInput;
  output: OpenapiToConfigSingleOutput;
};

/**
 * @private
 */
export type OpenapiToConfig = {
  /** Array of OpenapiTo project to use.*/
  servers: Array<OpenapiToConfigServer>;
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

export type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

export type OpenAPIAllDocument =
  | OpenAPIV2.Document
  | OpenAPIV3.Document
  | OpenAPIV3_1.Document;

export type PossiblePromise<T> = Promise<T> | T;

export enum PluginStatus {
  Succeeded = "succeeded",
  Failed = "failed",
}
