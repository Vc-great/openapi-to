/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { PackageManager } from "@openapi-to/core";

import type { OpenapiToUserConfig } from "@openapi-to/core";

function isJSONPlugins(
  plugins: OpenapiToUserConfig["plugins"],
): plugins is Array<[name: string, options: object]> {
  return !!(plugins as Array<[name: string, options: object]>[])?.some(
    (plugin) => {
      return Array.isArray(plugin) && typeof plugin?.at(0) === "string";
    },
  );
}

function isObjectPlugins(
  plugins: OpenapiToUserConfig["plugins"],
): plugins is any {
  return plugins instanceof Object && !Array.isArray(plugins);
}

async function importPlugin(
  name: string,
  options: object,
): Promise<OpenapiToUserConfig["plugins"]> {
  const packageManager = new PackageManager(process.cwd());

  const importedPlugin: any =
    process.env.NODE_ENV === "test"
      ? await import(name)
      : await packageManager.import(name);

  // eslint-disable-next-line
  return importedPlugin?.default
    ? importedPlugin.default(options)
    : importedPlugin(options);
}

export function getPlugins(
  plugins: OpenapiToUserConfig["plugins"],
): Promise<OpenapiToUserConfig["plugins"]> {
  if (isObjectPlugins(plugins)) {
    throw new Error(
      "Object plugins are not supported anymore",
    );
  }

  if (isJSONPlugins(plugins)) {
    const jsonPlugins = plugins as Array<[name: string, options: object]>;
    const promises = jsonPlugins.map((plugin) => {
      const [name, options = {}] = plugin;
      return importPlugin(name, options);
    });
    return Promise.all(promises) as Promise<OpenapiToUserConfig["plugins"]>;
  }

  return Promise.resolve(plugins);
}
