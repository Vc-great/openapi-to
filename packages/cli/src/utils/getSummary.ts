import { LogLevel, PluginStatus, randomCliColour } from "@openapi-to/core";

import _ from "lodash";
import c from "picocolors";

import { diffHrtime } from "./diffHrtime.ts";

import type { PluginStatusValue } from "@openapi-to/core";
import type { OpenapiToSingleConfig, PluginManager } from "@openapi-to/core";
import type { Logger } from "@openapi-to/core";

type SummaryProps = {
  pluginManager: PluginManager;
  status: PluginStatusValue;
  startHrtime: [number, number];
  openapiToSingleConfig: OpenapiToSingleConfig;
  logger: Logger;
};

export function getSummary({
  pluginManager,
  status,
  startHrtime,
  openapiToSingleConfig,
  logger,
}: SummaryProps): string[] {
  const { logLevel } = logger;
  const logs: string[] = [];
  const elapsedSeconds = diffHrtime(process.hrtime(startHrtime));

  const pluginsCount = openapiToSingleConfig.plugins?.length || 0;

  const successfulPlugin = _.chain(pluginManager.executed)
    .filter(["status", PluginStatus.Succeeded])
    .value();

  const failedPlugins = _.chain(pluginManager.executed)
    .filter(["status", PluginStatus.Failed])
    .value();

  const fileTotal = _.chain(pluginManager.executed)
    .map("filePaths")
    .map((filePaths) => filePaths.length)
    .reduce((total, fileCount) => (total += fileCount), 0)
    .value();

  const file = _.chain(pluginManager.executed)
    .map((item) => {
      return _.map(item.filePaths, (filePath) => {
        return {
          path: filePath,
          name: item.name,
        };
      });
    })
    .flatten()
    .value();

  const meta = {
    name: openapiToSingleConfig.input.name,
    plugins:
      status === PluginStatus.Succeeded
        ? `${c.green(
            `${successfulPlugin.length} successful`,
          )}, ${pluginsCount} total`
        : `${c.red(
            `${failedPlugins?.length ?? 1} failed`,
          )}, ${pluginsCount} total`,
    pluginsFailed:
      status === PluginStatus.Failed
        ? failedPlugins?.map(({ name }) => randomCliColour(name))?.join(", ")
        : undefined,
    filesCreated: fileTotal,
    time: c.yellow(`${elapsedSeconds}s`),
    output: openapiToSingleConfig.output.dir,
  } as const;

  if (logLevel === LogLevel.debug) {
    logger.emit("debug", ["\nGenerated files:\n"]);
    logger.emit(
      "debug",
      file.map(
        (item) => `${randomCliColour(JSON.stringify(item.name))} ${item.path}`,
      ),
    );
  }

  logs.push(
    [
      [`\n`, true],
      [`     ${c.bold("Name:")}      ${meta.name}`, !!meta.name],
      [`  ${c.bold("Plugins:")}      ${meta.plugins}`, true],
      [
        `   ${c.dim("Failed:")}      ${meta.pluginsFailed || "none"}`,
        !!meta.pluginsFailed,
      ],
      [`${c.bold("Generated:")}      ${meta.filesCreated} files`, true],
      [`     ${c.bold("Time:")}      ${meta.time}`, true],
      [`   ${c.bold("Output:")}      ${meta.output}`, true],
      [`\n`, true],
    ]
      .map((item) => {
        if (item.at(1)) {
          return item.at(0);
        }
        return undefined;
      })
      .filter(Boolean)
      .join("\n"),
  );

  return logs;
}
