import { build, PluginStatus } from "@openapi-to/core";
import { createLogger, LogLevel, randomCliColour } from "@openapi-to/core";

import c from "picocolors";
import process from "process";

import { getSummary } from "./utils/getSummary.ts";
import { spinnerFunc} from "./utils/spinner.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
import type { CLIOptions } from "@openapi-to/core";

export async function generate(
  openapiToSingleConfig: OpenapiToSingleConfig,
  CLIOptions: CLIOptions,

): Promise<void> {
  const inputPath = openapiToSingleConfig.input.path;
  const spinner = spinnerFunc()
  const logger = createLogger({
    logLevel: CLIOptions.logLevel || LogLevel.silent,
    name: openapiToSingleConfig.name ||'',
    spinner,
  });

  if (logger.name) {
    spinner.prefixText = randomCliColour(logger.name);
  }

  const startHrtime = process.hrtime();

  if (CLIOptions.logLevel === LogLevel.debug) {
    const { performance, PerformanceObserver } = await import(
      "node:perf_hooks"
    );

    const performanceOpserver = new PerformanceObserver((items) => {
      const message = `${items.getEntries()[0]?.duration.toFixed(0)}ms`;

      spinner.suffixText = c.yellow(message);

      performance.clearMarks();
    });

    performanceOpserver.observe({ type: "measure" });
  }

  const logLevel = logger.logLevel;

  spinner.start(`🚀 Building ${logLevel !== "silent" ? c.dim(inputPath) : ""}`);

  const { pluginManager, error } = await build(
    openapiToSingleConfig,
    CLIOptions,
    logger,
  );

  const summary = getSummary({
    pluginManager,
    openapiToSingleConfig,
    status: error ? PluginStatus.Failed : PluginStatus.Succeeded,
    startHrtime,
    logger,
  });

  if (error) {
    spinner.suffixText = "";
    spinner.fail(
      `🚀 Build failed ${logLevel !== "silent" ? c.dim(inputPath) : ""}`,
    );

    console.log(summary.join(""));

    throw error;
  }

  spinner.suffixText = "";
  spinner.succeed(
    `🚀 Build completed ${logLevel !== "silent" ? c.dim(inputPath) : ""}`,
  );

  console.log(summary.join(""));
}
