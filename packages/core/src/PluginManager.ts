import _ from "lodash";
import process from "process";

import { folderName } from "./folderName.ts";
import { LogLevel } from "./logger.ts";
import { LifeCycleEnum } from "./types.ts";

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
export const enum PluginStatus {
  Succeeded = "succeeded",
  Failed = "failed",
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

  get output(): string {
    return (
      this.openapiToSingleConfig.output ||
      process.cwd() +
        "/" +
        folderName +
        "/" +
        this.openapiToSingleConfig.input.name
    );
  }
  get context(): PluginContext {
    return {
      output: this.output,
    };
  }

  /**
   * 执行插件
   * @param plugin
   */
  execute(plugin: PluginFactory): void {
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
    lifeCycle.buildStart(this.context);
    //
    this.logger.emit("start", `💾 Writing`);
    const filePaths = lifeCycle.writeFile(this.context);
    if (this.logger.logLevel === LogLevel.info) {
      this.logger.emit("end", `💾 Writing completed`);
    }
    //
    lifeCycle.buildEnd(this.context);
    this.executed.push({
      ...pluginStatus,
      status: PluginStatus.Succeeded,
      filePaths: filePaths,
    });
  }

  run(): void {
    this.plugins.forEach((plugin) => this.execute(plugin));
  }
}
