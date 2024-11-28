import { PluginStatus } from "./types.ts";

import type { Logger } from "./logger.ts";
import type { WriteFile } from "./types.ts";
import type {
  OpenAPIDocument,
  OpenapiToSingleConfig,
  PluginConfigFactory,
  PluginContext,
  PluginFactory,
} from "./types.ts";
export function createPlugin<T>(
  pluginConfigFactory: PluginConfigFactory<T>,
): PluginConfigFactory<T> {
  return pluginConfigFactory;
}
import _ from "lodash";

import { write } from "./fs";
export type PluginStatusValue = `${PluginStatus}`;
type Executed = {
  name: string;
  status: PluginStatusValue;
  files: WriteFile;
};

export class PluginManager {
  private plugins: Array<PluginFactory>;
  readonly executed: Array<Executed> = [];
  filesCreated: number = 0;
  constructor(
    private readonly openapiToSingleConfig: OpenapiToSingleConfig,
    private readonly openapiDocument: OpenAPIDocument,
    private readonly logger: Logger,
  ) {
    this.openapiToSingleConfig = openapiToSingleConfig;
    this.plugins = openapiToSingleConfig.plugins;
    this.openapiDocument = openapiDocument;
    this.logger = logger;
  }
  get context(): PluginContext {
    return {};
  }

  /**
   * 执行插件
   * @param plugin
   */
  async execute(plugin: PluginFactory): Promise<void> {
    const lifeCycle = plugin({
      openapiDocument: this.openapiDocument,
      openapiToSingleConfig: this.openapiToSingleConfig,
    });
    const pluginStatus = {
      name: lifeCycle.name,
      status: "",
      fileTotal: 0,
    };

    //
    await lifeCycle.buildStart(this.context);

    const files = await lifeCycle.writeFile(this.context);

    //
    await lifeCycle.buildEnd(this.context);
    this.executed.push({
      ...pluginStatus,
      status: PluginStatus.Succeeded,
      files: files,
    });
  }

  async writeFile() {
    const promises = _.chain(this.executed)
      .map((item) => item.files)
      .flatten()
      .map(async (file) =>
        write(file.filePath, file.fileText, { sanity: false }),
      )
      .value();
    return Promise.all(promises);
  }

  async run(): Promise<void> {
    const map = this.plugins.map((plugin) => this.execute(plugin));
    await Promise.all(map);
    const files = await this.writeFile();
    this.filesCreated = files.length;
  }
}
