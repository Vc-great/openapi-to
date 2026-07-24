import { optionsCJS, optionsESM } from '@openapi-to/config-tsup'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    ...optionsCJS,
    clean: false,
    noExternal: [/find-up/],
  },
  {
    ...optionsESM,
    clean: false,
  },
  {
    ...optionsCJS,
    clean: false,
    entry: {
      utils: 'src/utils/index.ts',
    },
    name: 'utils',
    noExternal: [/find-up/],
  },
  {
    ...optionsESM,
    clean: false,
    entry: {
      utils: 'src/utils/index.ts',
    },
    name: 'utils',
    noExternal: [/find-up/],
  },
])
