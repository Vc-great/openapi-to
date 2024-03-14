import path from "node:path";

import { Warning } from "@openapi-to/core";
import {formatOpenapiToConfig} from "@openapi-to/core/src/utils/formatOpenapiToConfig.ts";

import { cac } from "cac";
import c from "picocolors";
import process from "process";

// @ts-ignore
import { version } from "../../openapi/package.json";
import { getCosmiConfig } from "./utils/getCosmiConfig.ts";
import { getDefineConfig } from "./utils/getDefineConfig.ts";
import { renderErrors } from "./utils/renderErrors.ts";
import { spinner } from "./utils/spinner.ts";
import { generate } from "./generate.ts";
import { init } from "./init.ts";

import type { CLIOptions } from "@openapi-to/core";

const moduleName = "openapi";

function programCatcher(e: unknown, CLIOptions: CLIOptions): void {
  const error = e as Error;
  const message = renderErrors(error, { logLevel: CLIOptions.logLevel });

  if (error instanceof Warning) {
    spinner.warn(c.yellow(error.message));
    process.exit(0);
  }

  spinner.fail(message);
  process.exit(1);
}

async function generateAction(CLIOptions: CLIOptions) {
  spinner.start("💾 Loading config");
  const result = await getCosmiConfig(moduleName);
  spinner.succeed(
    `🔍 Config loaded(${c.dim(path.relative(process.cwd(), result.filepath))})`,
  );

  const openapiToConfig = getDefineConfig(result);

  for (const server of openapiToConfig.servers) {
    const openapiToSingleConfig = formatOpenapiToConfig(server,openapiToConfig)
    await generate(openapiToSingleConfig, CLIOptions);
  }

  return;
}

export async function run(argv?: string[]): Promise<void> {
  const program = cac(moduleName);
  //todo
  program
    .command("g", "Generate code from the openapi.config.js file")
    .option("-l, --log-level <type>", "Info, silent or debug")
    .option("-w, --watch", "Watch mode based on the input file")
    .action(generateAction);

  program.command("init", "Generate openapi.config.js file").action(init);

  program.help();
  program.version(version);
  program.parse(argv, { run: false });

  try {
    await program.runMatchedCommand();
    process.exit(0);
  } catch (e) {
    programCatcher(e, program.options);
  }
}

export default run;
