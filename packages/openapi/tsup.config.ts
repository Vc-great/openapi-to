import { optionsCJS, optionsESM } from "@openapi-to/tsup-config";

import { defineConfig } from "tsup";

export default defineConfig([
  optionsCJS,
  optionsESM,
  {
    ...optionsESM,
    sourcemap: true,
    entry: {
      utils: "src/utils.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
  {
    ...optionsCJS,
    sourcemap: true,
    entry: {
      utils: "src/utils.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
]);
