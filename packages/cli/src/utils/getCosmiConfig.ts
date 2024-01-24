/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { bundleRequire } from "bundle-require";
import { cosmiconfig } from "cosmiconfig";

import { folderName } from "./folderName.js";

import type { CosmiconfigResult } from "../types.ts";
const tsLoader = async (configFile: string) => {
  const { mod } = await bundleRequire({
    filepath: configFile,
  });

  return mod.default;
};

export async function getCosmiConfig(
  moduleName: string,
): Promise<CosmiconfigResult> {
  const searchPlaces = [`${moduleName}.config.js`, `${moduleName}.config.ts`];
  const explorer = cosmiconfig(moduleName, {
    cache: false,
    searchPlaces: [
      ...searchPlaces.map((searchPlace) => {
        return `${folderName}/${searchPlace}`;
      }),
    ],
    loaders: {
      ".ts": tsLoader,
    },
  });

  const result = await explorer.search();

  if (result?.isEmpty || !result || !result.config) {
    throw new Error("Config not defined, create a openapi.config.js");
  }

  return result as CosmiconfigResult;
}
