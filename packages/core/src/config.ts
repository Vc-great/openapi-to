import type {
  CLIOptions,
  OpenapiToConfigInput,
  OpenapiToSingleConfig,
} from "./types.ts";
import type { PossiblePromise } from "./utils";

/**
 * Type helper to make it easier to use openapi.config.js
 * accepts a direct {@link OpenapiToConfig} object, or a function that returns it.
 * The function receives a {@link ConfigEnv} object that exposes two properties:
 */
export function defineConfig(
  options:
    | PossiblePromise<OpenapiToSingleConfig>
    | ((
        /** The options derived from the CLI flags */
        cliOptions: CLIOptions,
      ) => PossiblePromise<OpenapiToSingleConfig>),
): typeof options {
  return options;
}

export function isInputPath(
  result: OpenapiToConfigInput | undefined,
): result is OpenapiToConfigInput {
  return !!result && "path" in (result as any);
}
