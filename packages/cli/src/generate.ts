import {
  createLogger,
  LogLevel,
  randomPicoColour,
} from "@openapi-to/core/utils";

import pc from "picocolors";

import { spinner } from "./utils/spinner.ts";

import type { CLIOptions, Input, OpenapiToConfig } from "@openapi-to/core";

type GenerateProps = {
  input: Input;
  config: OpenapiToConfig;
  CLIOptions: CLIOptions;
};

export async function generate({
  input,
  config,
  CLIOptions,
}: GenerateProps): Promise<void> {
  const inputPath = input.path;
  const logger = createLogger({
    logLevel: CLIOptions.logLevel || LogLevel.silent,
    name: input.name,
    spinner,
  });

  if (logger.name) {
    spinner.prefixText = randomPicoColour(logger.name);
  }

  const hrstart = process.hrtime();

  if (CLIOptions.logLevel === LogLevel.debug) {
    const { performance, PerformanceObserver } = await import(
      "node:perf_hooks"
    );

    const performanceOpserver = new PerformanceObserver((items) => {
      const message = `${items.getEntries()[0]?.duration.toFixed(0)}ms`;

      spinner.suffixText = pc.yellow(message);

      performance.clearMarks();
    });

    performanceOpserver.observe({ type: "measure" });
  }

  const logLevel = logger.logLevel;

  spinner.start(
    `🚀 Building ${logLevel !== "silent" ? pc.dim(inputPath) : ""}`,
  );
}
