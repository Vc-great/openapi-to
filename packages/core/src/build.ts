import axios from "axios";
import converter from "do-swagger2openapi";
import fs from "fs-extra";
import _ from "lodash";

import { URLPath } from "./utils";

import type { AxiosResponse } from "axios";
import type { OpenAPIV2, OpenAPIV3 } from "openapi-types";
import type { OpenAPIV3_1 } from "openapi-types";
import type {
  CLIOptions,
  OpenAPIAllDocument,
  OpenAPIDocument,
  OpenapiToConfig,
  OpenapiToConfigSingleInput,
  OpenapiToSingleConfig,
  PluginFactory,
} from "./types.ts";

export async function requestRemoteData(
  requestUrl: string,
): Promise<OpenAPIAllDocument | undefined> {
  try {
    const response = await axios.get<null, AxiosResponse<OpenAPIAllDocument>>(
      requestUrl,
    );

    return response.data;
  } catch (error) {
    //todo error
    console.error(error);
    return undefined;
  }
}

//读取本地文件
async function readLocalFiles(filePath: string): Promise<OpenAPIAllDocument> {
  console.log("-> readLocalFiles");
  return fs.readJsonSync(filePath);
}

//加载数据 本地或者远程
async function loadData(path: string) {
  //判断是本地还是远程url
  const openapiDocument = new URLPath(path).isURL
    ? await requestRemoteData(path)
    : await readLocalFiles(path);

  if (_.isUndefined(openapiDocument)) {
    return undefined;
  }

  return await swagger2ToOpenapi3(openapiDocument);
}

//
export async function swagger2ToOpenapi3(
  openapiDocument: OpenAPIAllDocument,
): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document | undefined> {
  if ("openapi" in openapiDocument) {
    return openapiDocument;
  }

  //log  "💺 将 Swagger 转化为 openAPI";
  const [err, options] = await converter
    .convertObj(<OpenAPIV2.Document>openapiDocument, {})
    .then(
      (options) => [undefined, options],
      (err) => [err, undefined],
    );

  if (err) {
    throw new Error(
      "An error occurred with the conversion of swagger to openapi." + err,
    );
  }
  return options.openapi;
}

export async function build(
  input: OpenapiToConfigSingleInput,
  openapiToConfig: OpenapiToConfig,
  CLIOptions: CLIOptions,
) {
  const config = {
    input: input,
    ..._.omit(openapiToConfig, ["input", "plugins"]),
    plugins: openapiToConfig.plugins,
  };
  await run(config);
}

/**
 *
 *   input: OpenapiToConfigInput,
 *   plugins: Array<OpenapiToConfigPlugin>,
 *
 */
async function run(config: OpenapiToSingleConfig) {
  const logger = {};
  const {
    input: { path },
  } = config;

  const openapiDocument = await loadData(path);

  if (_.isUndefined(openapiDocument)) {
    throw new Error("Unable to get the OpenAPI Document!");
  }
  //执行每一个插件
  const pluginManager = new PluginManager(config, openapiDocument);

  pluginManager.run();

  // logger.spinner.succeed(`💾 Writing completed`)
}

class PluginManager {
  private plugins: Array<PluginFactory>;
  constructor(
    private readonly openapiToSingleConfig: OpenapiToSingleConfig,
    private readonly openapiDocument: OpenAPIDocument,
  ) {
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.plugins = openapiToSingleConfig.plugins;
    this.openapiDocument = openapiDocument;
  }

  /**
   * 执行插件
   * @param plugin
   */
  execute(plugin: PluginFactory) {
    const lifeCycle = plugin({
      openapiDocument: this.openapiDocument,
      openapiToSingleConfig: this.openapiToSingleConfig,
    });
    //
    lifeCycle.buildStart();
    //
    lifeCycle.writeFile();
    //
    lifeCycle.buildEnd();
  }

  run() {
    this.plugins.forEach((plugin) => this.execute(plugin));
  }
}
