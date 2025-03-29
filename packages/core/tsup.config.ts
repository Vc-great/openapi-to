import { optionsCJS, optionsESM } from "@openapi-to/config-tsup";

import { defineConfig } from "tsup";

export default defineConfig([
  {
    ...optionsCJS,
    noExternal: [/find-up/],
  },
  optionsESM,
  {
    ...optionsCJS,
    entry: {
      utils: "src/utils/index.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
  {
    ...optionsESM,
    entry: {
      utils: "src/utils/index.ts",
    },
    name: "utils",
    noExternal: [/find-up/],
  },
]);
