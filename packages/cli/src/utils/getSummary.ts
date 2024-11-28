import path from "node:path";

import { randomCliColour } from "@openapi-to/core";
import { PluginStatus } from "@openapi-to/core";

import _ from "lodash";
import c from "tinyrainbow";

import { parseHrtimeToSeconds } from "./parseHrtimeToSeconds.ts";

import type { OpenapiToSingleConfig, PluginManager } from "@openapi-to/core";

type SummaryProps = {
  pluginManager: PluginManager;
  status: "success" | "failed";
  hrStart: [number, number];
  config: OpenapiToSingleConfig;
};

export function getSummary({
  pluginManager,
  status,
  hrStart,
  config,
}: SummaryProps): string[] {
  const logs = new Set<string>();
  const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(hrStart));

  const successfulPlugins = _.chain(pluginManager.executed)
    .filter(["status", PluginStatus.Succeeded])
    .map((item) => item.name)
    .value();

  const failedPlugins = _.chain(pluginManager.executed)
    .filter(["status", PluginStatus.Failed])
    .map((item) => item.name)
    .value();

  const pluginsCount = config.plugins?.length || 0;

  const meta = {
    plugins:
      status === "success"
        ? `${c.green(`${successfulPlugins.length} successful`)}, ${pluginsCount} total`
        : `${c.red(`${failedPlugins?.length ?? 1} failed`)}, ${pluginsCount} total`,
    pluginsFailed:
      status === "failed"
        ? failedPlugins?.map((name) => randomCliColour(name))?.join(", ")
        : undefined,
    filesCreated: pluginManager.filesCreated,
    time: `${c.yellow(`${elapsedSeconds}s`)}`,
    //todo
    output: path.resolve(config.output.dir),
  } as const;

  logs.add(
    [
      [`${c.bold("Plugins:")}        ${meta.plugins}`, true],
      [
        `${c.dim("Failed:")}          ${meta.pluginsFailed || "none"}`,
        !!meta.pluginsFailed,
      ],
      [
        `${c.bold("Generated:")}      ${meta.filesCreated} files in ${meta.time}`,
        true,
      ],
      [`${c.bold("Output:")}         ${meta.output}`, true],
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

  return [...logs];
}
