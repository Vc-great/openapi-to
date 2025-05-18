export type * from '../OpenAPIContext/types.ts'

export type * from './OpenAPI.ts'
export type * from './DefineConfig.ts'
export type * from '../pluginManager/types.ts'

export type * from './CLIOptions.ts'

// null will mean clear the watcher for this key
export type TransformResult = string | null
