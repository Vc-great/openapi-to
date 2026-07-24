import type {
	OpenapiToConfig,
	OpenapiToConfigServer,
	OpenapiToSingleConfig,
} from "../types";
import { resolveConfiguredOutputRoot } from "../config/outputRoot.ts";

/**
 * openapiToConfig to openapiToSingleConfig
 * @param server
 * @param openapiToConfig
 */
export function formatOpenapiToConfig(
	root: string,
	server: OpenapiToConfigServer,
	openapiToConfig: OpenapiToConfig,
): OpenapiToSingleConfig {
	const resolved = resolveConfiguredOutputRoot({
		workspaceRoot: root,
		output: server.output,
		targetName: server.name,
	});
	return {
		...server,
		root,
		output: {
			...server.output,
			base: resolved.base,
			dir: resolved.absolutePath,
		},
		plugins: openapiToConfig.plugins,
	};
}
