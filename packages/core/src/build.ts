import fetch from "node-fetch";
import { URLPath } from "./utils";
import _ from "lodash";
import fs from "fs-extra";
import { OpenAPIV3, OpenAPIV2 } from "openapi-types";
import converter from "do-swagger2openapi";
import type {
  OpenapiToConfigPlugin,
  OpenapiToSingleConfig,
  OpenAPIV3AllDocument,
} from "./types.ts";

type OpenAPIAllDocument = OpenAPIV2.Document | OpenAPIV3.Document;

async function requestRemoteData(
  requestUrl: string,
): Promise<OpenAPIAllDocument | undefined> {
  try {
    const response = await fetch(requestUrl);
    return (await response.json()) as OpenAPIAllDocument;
  } catch (error) {
    //todo error
    console.error(error);
    return undefined;
  }
}

//读取本地文件
async function readLocalFiles(filePath: string): Promise<OpenAPIAllDocument> {
  return fs.readJsonSync(filePath);
}

//加载数据 本地或者远程
async function loadData(input: any) {
  //判断是本地还是远程url
  const openapiDocument = new URLPath(input).isURL
    ? await readLocalFiles(input)
    : await requestRemoteData(input);

  if (_.isUndefined(openapiDocument)) {
    return undefined;
  }

  return swagger2ToOpenapi3(openapiDocument);
}

//
async function swagger2ToOpenapi3(
  openapiDocument: OpenAPIAllDocument,
): Promise<OpenAPIV3.Document | undefined> {
  if ("openapi" in openapiDocument) {
    return Promise.resolve(openapiDocument);
  }

  // infoLog("💺 将 Swagger 转化为 openAPI");
  const [err, options] = await converter
    .convertObj(<OpenAPIV2.Document>openapiDocument, {})
    .then(
      (options) => [undefined, options],
      (err) => [err, undefined],
    );
  if (err) {
    //todo log
    return undefined;
  }
  return options.openapi;
}

export async function build(option: any) {
  const map = _.map(option.input, (input) => {
    const config = {
      input: input,
      ..._.omit(option, ["input", "plugins"]),
      plugins: option.plugins,
    };
    run(config);
  });
  const result = await Promise.allSettled(map);
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
  //获取接口文档
  const openapiDocument = await loadData(path);

  if (_.isUndefined(openapiDocument)) {
    //todo error
    return;
  }
  //执行每一个插件
  const pluginManager = new PluginManager(config, openapiDocument);

  pluginManager.run();

  // logger.spinner.succeed(`💾 Writing completed`)
}

class PluginManager {
  private plugins: Array<OpenapiToConfigPlugin>;
  constructor(
    private readonly config: OpenapiToSingleConfig,
    private readonly openapiDocument: OpenAPIV3AllDocument,
  ) {
    this.config = config;
    this.plugins = config.plugins;
    this.openapiDocument = openapiDocument;
  }

  /**
   * 执行插件
   * @param plugin
   */
  execute(plugin: OpenapiToConfigPlugin) {
    //
    plugin.buildStart(this.config, this.openapiDocument);
    //
    plugin.writeFileSync(this.config, this.openapiDocument);
    //
    plugin.buildEnd(this.config, this.openapiDocument);
  }

  run() {
    this.plugins.forEach((plugin) => this.execute(plugin));
  }
}
