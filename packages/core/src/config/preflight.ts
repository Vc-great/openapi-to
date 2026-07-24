import type { RemoteSourceOptions } from "../types";
import {
	compileOpenAPI,
	type OpenAPICompilation,
} from "../openapi/compiler.ts";
import type { LoadedSource } from "../openapi/sourceLoader.ts";
import type { OpenapiToConfig, OpenapiToSingleConfig } from "../types";
import {
	selectConfiguredTargets,
	type ConfiguredTarget,
} from "./configuredTargets.ts";
import {
	resolveConfiguredTargetOutputs,
	type ResolvedConfiguredOutputRoot,
} from "./outputRoot.ts";

export interface PreparedConfiguredTarget extends ConfiguredTarget {
	config: OpenapiToSingleConfig;
	output: ResolvedConfiguredOutputRoot;
	compilation?: OpenAPICompilation;
}

export interface PreflightConfiguredTargetsOptions {
	workspaceRoot: string;
	requestedTargets?: string | readonly string[];
	localFileRoot?: string;
	remote?: RemoteSourceOptions;
	signal?: AbortSignal;
	compileInputs?: boolean;
}

function remotePolicyIdentity(remote: RemoteSourceOptions | undefined): string {
	return JSON.stringify({
		allowPrivateNetwork: remote?.allowPrivateNetwork === true,
		allowedHosts: [...(remote?.allowedHosts ?? [])].sort(),
		headers: Object.entries(remote?.headers ?? {}).sort(([left], [right]) =>
			left < right ? -1 : left > right ? 1 : 0,
		),
		timeoutMs: remote?.timeoutMs,
		maxResponseBytes: remote?.maxResponseBytes,
		maxRedirects: remote?.maxRedirects,
	});
}

/**
 * Shared configuration preflight for CLI, MCP, CI, and Node callers.
 * It validates every target identity and output boundary, then loads and
 * compiles every selected input before a caller may begin writing.
 */
export async function preflightConfiguredTargets(
	openapiToConfig: OpenapiToConfig,
	options: PreflightConfiguredTargetsOptions,
): Promise<PreparedConfiguredTarget[]> {
	const allTargets = selectConfiguredTargets({
		servers: openapiToConfig.servers,
	});
	const selected = selectConfiguredTargets({
		servers: openapiToConfig.servers,
		requestedTargets: options.requestedTargets,
	});
	const outputs = await resolveConfiguredTargetOutputs(
		options.workspaceRoot,
		allTargets,
	);
	const prepared = selected.map((target) => {
		const output = outputs.get(target.name);
		if (!output) {
			throw new Error(
				"Configured target output preflight lost its target mapping.",
			);
		}
		return {
			...target,
			output,
			config: {
				...target.server,
				root: options.workspaceRoot,
				name: target.name,
				input: {
					...target.server.input,
					...(options.remote ? { remote: options.remote } : {}),
				},
				output: {
					...target.server.output,
					base: output.base,
					dir: output.absolutePath,
				},
				plugins: openapiToConfig.plugins,
			},
		};
	});
	if (options.compileInputs === false) return prepared;
	const sourceCaches = new Map<
		string,
		Map<string, Promise<LoadedSource>>
	>();
	return Promise.all(
		prepared.map(async (target) => {
			const policyIdentity = remotePolicyIdentity(target.config.input.remote);
			let sourceCache = sourceCaches.get(policyIdentity);
			if (!sourceCache) {
				sourceCache = new Map<string, Promise<LoadedSource>>();
				sourceCaches.set(policyIdentity, sourceCache);
			}
			return {
				...target,
				compilation: await compileOpenAPI(target.config.input.path, {
					cwd: options.workspaceRoot,
					localFileRoot: options.localFileRoot,
					remote: target.config.input.remote,
					cache: sourceCache,
					signal: options.signal,
				}),
			};
		}),
	);
}
