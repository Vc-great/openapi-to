import { build } from "./build.ts";

export * from "./defineConfig";
export * from "./errors.ts";
export { Generator } from "./Generator.ts";
export { PackageManager } from "./PackageManager.ts";
// dprint-ignore
export { SchemaGenerator } from "./SchemaGenerator.ts";
export * from "./types.ts";
/*
export default build;*/
export { build } from "./build.ts";
export { AST } from "./ast/ast.ts";
export { OpenAPI } from "./openapi/OpenAPI.ts";
export {createPlugin} from './plugins.ts'
/*



export interface _Register {}
export type Plugins = _Register;
export type OptionsPlugins = { [K in keyof Plugins]: Plugins[K]["options"] };
* */
