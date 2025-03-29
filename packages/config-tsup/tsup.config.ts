import { defineConfig } from 'tsup'

import { optionsCJS, optionsESM } from './src'

export default defineConfig([optionsCJS, optionsESM])
