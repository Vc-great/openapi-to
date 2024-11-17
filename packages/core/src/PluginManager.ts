import _ from "lodash";

import { LogLevel } from "./logger.ts";
import { LifeCycleEnum, PluginStatus } from "./types.ts";

import type { Logger } from "./logger.ts";
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

export type PluginStatusValue = `${PluginStatus}`;
type Executed = {
  name: string;
  status: PluginStatusValue;
  filePaths: string[];
};

export class PluginManager {
  private plugins: Array<PluginFactory>;
  readonly executed: Array<Executed> = [];

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
async  execute(plugin: PluginFactory): Promise<void> {
    const lifeCycle = plugin({
      openapiDocument: this.openapiDocument,
      openapiToSingleConfig: this.openapiToSingleConfig,
    });
    const pluginStatus = {
      name: lifeCycle.name,
      status: "",
      fileTotal: 0,
    };

    //check lifeCycle
    if (this.logger.logLevel === LogLevel.info) {
      const extraHookName = _.chain(lifeCycle)
        .keys()
        .filter((lifeCycleName) => lifeCycleName !== "name")
        .filter(
          (lifeCycleName) =>
            !Object.keys(LifeCycleEnum).includes(lifeCycleName),
        )
        .value();
      if (extraHookName) {
        this.logger.emit("warning", `No hook ${extraHookName.join("")} found`);
      }
    }

    //
   await lifeCycle.buildStart(this.context);
    //
    this.logger.emit("start", `💾 Writing`);
    const filePaths = lifeCycle.writeFile(this.context);
    if (this.logger.logLevel === LogLevel.info) {
      this.logger.emit("end", `💾 Writing completed`);
    }
    //
   await lifeCycle.buildEnd(this.context);
    this.executed.push({
      ...pluginStatus,
      status: PluginStatus.Succeeded,
      filePaths: filePaths,
    });
  }

  async run(): Promise<void> {
    const map  = this.plugins.map((plugin) => this.execute(plugin));
    await Promise.all(map)
  }
}
