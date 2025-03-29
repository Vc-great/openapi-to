import { optionsCJS, optionsESM } from "@openapi-to/config-tsup";

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
