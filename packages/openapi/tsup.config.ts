import { optionsCJS, optionsESM } from "@openapi-to/config-tsup";

import { defineConfig } from "tsup";

export default defineConfig([
  {
    ...optionsCJS,
    clean: false,
  },
  {
    ...optionsESM,
    clean: false,
  },
  {
    ...optionsESM,
    clean: false,
    sourcemap: true,
    entry: {
      utils: "src/utils.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
  {
    ...optionsCJS,
    clean: false,
    sourcemap: true,
    entry: {
      utils: "src/utils.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
]);
