import { optionsCJS, optionsESM } from "@openapi-to/tsup-config";

import { defineConfig } from "tsup";

export default defineConfig([
  {
    ...optionsCJS,
    sourcemap: true,
    noExternal: [/find-up/],
  },
  optionsESM,
  {
    ...optionsCJS,
    sourcemap: true,
    entry: {
      utils: "src/utils/index.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
  {
    ...optionsESM,
    sourcemap: true,
    entry: {
      utils: "src/utils/index.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
]);
