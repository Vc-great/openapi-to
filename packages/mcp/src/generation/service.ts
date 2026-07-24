import { createHash } from "node:crypto";

import {
	buildFromCompilation,
	DiagnosticError,
	formatMaterializedArtifacts,
	hasDiagnosticErrors,
	materializeArtifacts,
	preflightConfiguredTargets,
	projectOpenAPICompilation,
	type Diagnostic,
	type GenerationManifestEntry,
	type OperationGenerationScope,
	type OpenapiToConfigServer,
	type OpenAPICompilation,
	type RemoteSourceOptions,
	type OutputWriteLock,
	type OpenAPIProjectionStats,
	type ResolvedConfiguredOutputRoot,
} from "@openapi-to/core";

import { McpToolError } from "../errors.ts";
import type { ResolvedMcpServerOptions } from "../options.ts";
import { sanitizeSourceDisplay } from "../security/source.ts";
import {
	resolveWorkspacePath,
	workspaceRelative,
} from "../security/workspace.ts";
import type { TrustedConfigProvider } from "./trusted-config.ts";
import type { TrustedTargetCatalogRegistry } from "../catalog/trusted-target-registry.ts";

function remotePolicyIdentity(remote: RemoteSourceOptions | undefined): string {
	return JSON.stringify({
		allowPrivateNetwork: remote?.allowPrivateNetwork === true,
		allowedHosts: [...new Set(remote?.allowedHosts ?? [])].sort(),
		headers: Object.entries(remote?.headers ?? {}).sort(([left], [right]) =>
			left < right ? -1 : left > right ? 1 : 0,
		),
		timeoutMs: remote?.timeoutMs,
		maxResponseBytes: remote?.maxResponseBytes,
		maxRedirects: remote?.maxRedirects,
	});
}

export interface GenerationExecution {
	signal?: AbortSignal;
	progress?: (stage: string, progress: number, total?: number) => Promise<void>;
	outputWriteLock?: OutputWriteLock;
	/** @internal Core transaction fault injection for repository tests only. */
	transactionFailpoint?: import("@openapi-to/core").TransactionFailpoint;
}

export interface PreparedTarget {
	name: string;
	server: OpenapiToConfigServer;
	config: Awaited<
		ReturnType<typeof preflightConfiguredTargets>
	>[number]["config"];
	output: ResolvedConfiguredOutputRoot;
	compilation?: OpenAPICompilation;
}

export interface GenerationRun {
	configPath: string;
	targets: string[];
	servers: GenerationServerRun[];
	diagnostics: Diagnostic[];
	selection?: {
		requestedOperationKeys: string[];
		resolvedOperationKeys: string[];
	};
	projection?: {
		stats: OpenAPIProjectionStats;
		projectionHash?: string;
	};
}

export interface GenerationServerRun {
	name: string;
	source: string;
	outputRoot: string;
	/** Hash of the merged Target/operator remote policy; never expose policy headers. */
	remotePolicyHash: string;
	result: Awaited<ReturnType<typeof buildFromCompilation>>;
	materialized: Awaited<
		ReturnType<typeof formatMaterializedArtifacts>
	>["artifacts"];
}

function preflightError(error: unknown): never {
	if (error instanceof DiagnosticError) {
		const diagnostic = error.diagnostics[0];
		if (diagnostic) {
			const code =
				diagnostic.code === "CONFIG_TARGET_UNKNOWN"
					? "MCP_UNKNOWN_TARGET"
					: diagnostic.code === "CONFIG_TARGET_NAME_CONFLICT" ||
							diagnostic.code === "CONFIG_TARGET_NAME_INVALID"
						? "MCP_CONFIG_LOAD_FAILED"
						: diagnostic.code;
			throw new McpToolError(code, diagnostic.message, diagnostic.hint);
		}
	}
	throw error;
}

export async function prepareTargets(
	provider: TrustedConfigProvider,
	options: ResolvedMcpServerOptions,
	requested: string[] | undefined,
	signal?: AbortSignal,
	compileInputs = false,
): Promise<{
	configPath: string;
	config: Awaited<ReturnType<TrustedConfigProvider["get"]>>["config"];
	targets: PreparedTarget[];
}> {
	const loaded = await provider.get(signal);
	try {
		const targets = await preflightConfiguredTargets(loaded.config, {
			workspaceRoot: options.workspaceRoot,
			localFileRoot: options.workspaceRoot,
			remote: options.remote,
			requestedTargets: requested,
			signal,
			compileInputs,
		});
		return {
			configPath: loaded.displayPath,
			config: loaded.config,
			targets: targets.map(({ name, server, config, output, compilation }) => ({
				name,
				server,
				config,
				output,
				...(compilation ? { compilation } : {}),
			})),
		};
	} catch (error) {
		preflightError(error);
	}
}

export async function validateConfiguredOutputRoots(
	provider: TrustedConfigProvider,
	options: ResolvedMcpServerOptions,
): Promise<string[]> {
	const prepared = await prepareTargets(provider, options, undefined);
	if (prepared.targets.length === 0)
		throw new McpToolError(
			"MCP_CONFIG_LOAD_FAILED",
			"Controlled write requires at least one configured generation target.",
		);
	return prepared.targets.map(({ output }) => output.absolutePath);
}

export async function executeGeneration(
	provider: TrustedConfigProvider,
	options: ResolvedMcpServerOptions,
	requested: string[] | undefined,
	mode: "dry-run" | "check",
	execution: GenerationExecution = {},
): Promise<GenerationRun> {
	await execution.progress?.("Loading trusted configuration", 5);
	const prepared = await prepareTargets(
		provider,
		options,
		requested,
		execution.signal,
		true,
	);
	const servers: GenerationServerRun[] = [];
	const compilationDiagnostics = prepared.targets.flatMap(
		({ compilation }) => compilation?.diagnostics ?? [],
	);
	if (hasDiagnosticErrors(compilationDiagnostics)) {
		return {
			configPath: prepared.configPath,
			targets: prepared.targets.map(({ name }) => name),
			servers,
			diagnostics: compilationDiagnostics,
		};
	}
	const diagnostics: Diagnostic[] = [];
	for (const target of prepared.targets) {
		if (execution.signal?.aborted) throw execution.signal.reason;
		if (!target.compilation)
			throw new McpToolError(
				"MCP_TOOL_EXECUTION_FAILED",
				"Configured target preflight did not compile the selected input.",
			);
		await execution.progress?.(
			"Compiling input and executing plugins",
			15 +
				Math.floor(
					(servers.length / Math.max(1, prepared.targets.length)) * 55,
				),
		);
		const single = target.config;
		const safeOutput = await resolveWorkspacePath(
			options.workspaceRoot,
			target.output.absolutePath,
			{ mustExist: false },
		);
		const result = await buildFromCompilation(single, target.compilation, {
			json: true,
			dryRun: mode === "dry-run",
			check: mode === "check",
			localFileRoot: options.workspaceRoot,
			signal: execution.signal,
			outputWriteLock: execution.outputWriteLock,
		});
		diagnostics.push(...result.diagnostics);
		const generated = result.generationResult?.artifacts ?? [];
		const materialized = materializeArtifacts(generated, safeOutput, {
			signal: execution.signal,
		});
		const formatted = await formatMaterializedArtifacts(
			materialized.artifacts,
			single.output.format,
			{ signal: execution.signal },
		);
		servers.push({
			name: target.name,
			source: sanitizeSourceDisplay(options.workspaceRoot, single.input.path),
			outputRoot: workspaceRelative(options.workspaceRoot, safeOutput),
			remotePolicyHash: createHash("sha256")
				.update(remotePolicyIdentity(single.input.remote))
				.digest("hex"),
			result,
			materialized: formatted.artifacts,
		});
	}
	await execution.progress?.(
		mode === "check" ? "Comparing generated files" : "Preparing artifact plan",
		85,
	);
	return {
		configPath: prepared.configPath,
		targets: prepared.targets.map(({ name }) => name),
		servers,
		diagnostics,
	};
}

export async function executeSelectiveGeneration(
	provider: TrustedConfigProvider,
	options: ResolvedMcpServerOptions,
	registry: TrustedTargetCatalogRegistry,
	requested: string[] | undefined,
	scope: OperationGenerationScope,
	execution: GenerationExecution = {},
	purpose: "preview" | "prepare" | "apply" = "preview",
): Promise<GenerationRun> {
	await execution.progress?.("Loading trusted configuration", 5);
	const prepared = await prepareTargets(
		provider,
		options,
		requested,
		execution.signal,
	);
	if (prepared.targets.length !== 1) {
		throw new McpToolError(
			"SELECTIVE_GENERATION_SINGLE_TARGET_REQUIRED",
			"Selective generation requires exactly one startup-configured target.",
			"Call openapi_list_targets, then pass one target name.",
		);
	}
	const [target] = prepared.targets;
	if (!target)
		throw new McpToolError(
			"MCP_UNKNOWN_TARGET",
			"The selected trusted target was not found.",
		);
	await execution.progress?.("Reusing cached target compilation", 15);
	const cached =
		purpose === "apply"
			? await registry.getCurrent(target.name, execution.signal)
			: await registry.get(target.name, execution.signal);
	if (!cached.catalog || !cached.compilation.document || !cached.success) {
		return {
			configPath: prepared.configPath,
			targets: [target.name],
			servers: [],
			diagnostics: cached.diagnostics,
		};
	}
	const projected = projectOpenAPICompilation(
		cached.compilation,
		cached.catalog,
		scope,
		{
			target: target.name,
			sourceHash: cached.sourceHash,
			signal: execution.signal,
		},
	);
	const base: GenerationRun = {
		configPath: prepared.configPath,
		targets: [target.name],
		servers: [],
		diagnostics: projected.diagnostics,
		selection: projected.selection,
		projection: {
			stats: projected.stats,
			...(projected.projectionHash
				? { projectionHash: projected.projectionHash }
				: {}),
		},
	};
	if (!projected.success || !projected.compilation) return base;

	await execution.progress?.(
		"Executing plugins against projected compilation",
		50,
	);
	const single = target.config;
	const safeOutput = await resolveWorkspacePath(
		options.workspaceRoot,
		target.output.absolutePath,
		{ mustExist: false },
	);
	// An ad-hoc selective preview must never propose deletion of unselected
	// managed artifacts. Selective Prepare instead generates the complete desired
	// persisted selection and therefore preserves the trusted cleanup setting.
	single.output =
		purpose === "preview"
			? { ...single.output, dir: safeOutput, clean: false }
			: { ...single.output, dir: safeOutput };
	const result = await buildFromCompilation(single, projected.compilation, {
		json: true,
		dryRun: true,
		localFileRoot: options.workspaceRoot,
		signal: execution.signal,
		outputWriteLock: execution.outputWriteLock,
	});
	const generated = result.generationResult?.artifacts ?? [];
	const materialized = materializeArtifacts(generated, safeOutput, {
		signal: execution.signal,
	});
	const formatted = await formatMaterializedArtifacts(
		materialized.artifacts,
		single.output.format,
		{ signal: execution.signal },
	);
	return {
		...base,
		servers: [
			{
				name: target.name,
				source: sanitizeSourceDisplay(options.workspaceRoot, single.input.path),
				outputRoot: workspaceRelative(options.workspaceRoot, safeOutput),
				remotePolicyHash: createHash("sha256")
					.update(remotePolicyIdentity(single.input.remote))
					.digest("hex"),
				result,
				materialized: formatted.artifacts,
			},
		],
		diagnostics: result.diagnostics,
	};
}

export function manifestHash(
	entries: readonly GenerationManifestEntry[],
): string {
	return createHash("sha256")
		.update(
			JSON.stringify(
				entries.map(({ path, status, hash, previousHash, bytes }) => ({
					path,
					status,
					hash,
					previousHash,
					bytes,
				})),
			),
		)
		.digest("hex");
}

export function generationSucceeded(run: GenerationRun): boolean {
	return (
		!hasDiagnosticErrors(run.diagnostics) &&
		run.servers.every(({ result }) => !result.error)
	);
}
