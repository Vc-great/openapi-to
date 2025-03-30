import { build } from "@openapi-to/core";
import { createLogger, LogMapper } from "@openapi-to/core";

import { Presets, SingleBar } from "cli-progress";
import c from "picocolors";
import process from "node:process";

import { getErrorCauses } from "./utils/getErrorCauses.ts";
import { getSummary } from "./utils/getSummary.ts";

import type { OpenapiToSingleConfig } from "@openapi-to/core";
import type { CLIOptions } from "@openapi-to/core";

export async function generate(
  openapiToSingleConfig: OpenapiToSingleConfig,
  CLIOptions: CLIOptions,
): Promise<void> {
  const inputPath = openapiToSingleConfig.input.path;

  const logLevel = CLIOptions.logLevel || 3;
  const logger = createLogger({
    logLevel,
    name: openapiToSingleConfig.name,
  });

  if (logger.logLevel !== LogMapper.debug) {
    const progressCache = new Map<string, SingleBar>();

    logger.on("progress_start", ({ id, size, message = "" }) => {
      logger.consola?.pauseLogs();
      const payload = { id, message };
      const progressBar = new SingleBar(
        {
          format: "{percentage}% {bar} {value}/{total} | {message}",
          barsize: 30,
          clearOnComplete: true,
          emptyOnZero: true,
        },
        Presets.shades_grey,
      );

      if (!progressCache.has(id)) {
        progressCache.set(id, progressBar);
        progressBar.start(size, 1, payload);
      }
    });

    logger.on("progress_stop", ({ id }) => {
      progressCache.get(id)?.stop();
      logger.consola?.resumeLogs();
    });

    logger.on("progressed", ({ id, message = "" }) => {
      const payload = { id, message };

      progressCache.get(id)?.increment(1, payload);
    });
  }

  logger.emit(
    "start",
    `Building ${logger.logLevel !== LogMapper.silent ? c.dim(inputPath) : ""}`,
  );
  const hrStart = process.hrtime();

  const { pluginManager, error } = await build(
    openapiToSingleConfig,
    CLIOptions,
    logger,
  );

  if (logger.logLevel === LogMapper.debug) {
    logger.consola?.start("Writing logs");

    const logFiles = await logger.writeLogs();

    logger.consola?.success(`Written logs: \n${logFiles.join("\n")}`);
  }

  const summary = getSummary({
    pluginManager,
    config: openapiToSingleConfig,
    status: error ? "failed" : "success",
    hrStart,
  });

  if (error && logger.consola) {
    logger.consola?.resumeLogs();
    logger.consola.error(
      `Build failed ${logger.logLevel !== LogMapper.silent ? c.dim(inputPath) : ""}`,
    );

    logger.consola.box({
      title: `${openapiToSingleConfig.name || ""}`,
      message: summary.join(""),
      style: {
        padding: 2,
        borderColor: "red",
        borderStyle: "rounded",
      },
    });

    const errors = getErrorCauses([error]);
    if (
      logger.consola &&
      errors.length &&
      logger.logLevel === LogMapper.debug
    ) {
      errors.forEach((err) => {
        logger.consola?.error(err);
      });
    }

    logger.consola?.error(error);

    process.exit(0);
  }

  logger.consola?.log(
    `⚡Build completed ${logger.logLevel !== LogMapper.silent ? c.dim(inputPath) : ""}`,
  );

  logger.consola?.box({
    title: `${openapiToSingleConfig.name || ""}`,
    message: summary.join(""),
    style: {
      padding: 2,
      borderColor: "green",
      borderStyle: "rounded",
    },
  });
}
