import { optionsCJS, optionsESM } from '@openapi-to/config-tsup'
import { defineConfig } from 'tsup'

export default defineConfig([
  { ...optionsCJS, entry: { index: 'src/index.ts', cli: 'src/cli.ts' } },
  { ...optionsESM, entry: { index: 'src/index.ts', cli: 'src/cli.ts' } },
])
