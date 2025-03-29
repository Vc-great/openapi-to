import { optionsCJS, optionsESM } from "@openapi-to/config-tsup";

import { defineConfig } from "tsup";

export default defineConfig([
  {
    ...optionsCJS,
  },
  {
    ...optionsESM,
  },
]);
