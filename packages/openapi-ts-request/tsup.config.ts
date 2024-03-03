import { optionsCJS, optionsESM } from '@openapi-to/tsup-config'

import { defineConfig } from 'tsup'

export default defineConfig([
  {
    ...optionsCJS,
  },
  optionsESM,
])
