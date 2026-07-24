import { DiagnosticError, type Diagnostic } from "../diagnostics.ts";
import type {
	OpenapiToConfigServer,
	OpenapiToConfigSingleInput,
} from "../types";

export interface ConfiguredTarget {
	name: string;
	index: number;
	server: OpenapiToConfigServer;
}

export interface SelectConfiguredTargetsOptions {
	servers: readonly OpenapiToConfigServer[];
	requestedTargets?: string | readonly string[];
}

function configurationError(
	code: string,
	message: string,
	path?: Array<string | number>,
	hint?: string,
): DiagnosticError {
	const diagnostic: Diagnostic = {
		code,
		severity: "error",
		message,
		...(path ? { location: { path } } : {}),
		...(hint ? { hint } : {}),
	};
	return new DiagnosticError("Configured target validation failed.", [
		diagnostic,
	]);
}

function normalizedIdentity(name: string): string {
	return name.normalize("NFKC").toLowerCase();
}

function hasControlCharacter(value: string): boolean {
	return [...value].some((character) => {
		const code = character.charCodeAt(0);
		return code <= 0x1f || code === 0x7f;
	});
}

function configuredName(server: OpenapiToConfigServer, index: number): string {
	if (server.name === undefined) return `server${index + 1}`;
	if (typeof server.name !== "string") {
		throw configurationError(
			"CONFIG_TARGET_NAME_INVALID",
			`Target ${index + 1} name must be a string.`,
			["servers", index, "name"],
		);
	}
	const normalized = server.name.trim().normalize("NFKC");
	if (
		normalized.length === 0 ||
		normalized.length > 200 ||
		hasControlCharacter(normalized) ||
		normalized !== server.name
	) {
		throw configurationError(
			"CONFIG_TARGET_NAME_INVALID",
			`Target ${index + 1} name must be a non-empty, normalized name without surrounding whitespace or control characters.`,
			["servers", index, "name"],
			"Use a stable explicit name such as user-service.",
		);
	}
	return normalized;
}

function validateInput(input: OpenapiToConfigSingleInput, index: number): void {
	if (
		!input ||
		typeof input !== "object" ||
		typeof input.path !== "string" ||
		input.path.trim().length === 0
	) {
		throw configurationError(
			"CONFIG_INPUT_PATH_INVALID",
			`Target ${index + 1} input.path must be a non-empty string.`,
			["servers", index, "input", "path"],
		);
	}
	const value = input.path.trim();
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw configurationError(
				"CONFIG_INPUT_PATH_INVALID",
				`Target ${index + 1} input.path is not a valid URL or local path.`,
				["servers", index, "input", "path"],
			);
		}
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw configurationError(
				"CONFIG_INPUT_PROTOCOL_UNSUPPORTED",
				`Target ${index + 1} input.path uses unsupported protocol ${url.protocol}.`,
				["servers", index, "input", "path"],
				"Use an http: or https: URL, or a Workspace-local filesystem path without a URL scheme.",
			);
		}
	}
}

/**
 * Validate configured target identities and select requested targets in
 * configuration order. Missing names retain the legacy `server1`, `server2`
 * fallback; explicit empty names are rejected.
 */
export function selectConfiguredTargets({
	servers,
	requestedTargets,
}: SelectConfiguredTargetsOptions): ConfiguredTarget[] {
	if (!Array.isArray(servers)) {
		throw configurationError(
			"CONFIG_TARGETS_INVALID",
			"OpenAPI configuration servers must be an array.",
			["servers"],
		);
	}
	const targets = servers.map((server, index) => {
		if (!server || typeof server !== "object") {
			throw configurationError(
				"CONFIG_TARGET_INVALID",
				`Target ${index + 1} must be an object.`,
				["servers", index],
			);
		}
		validateInput(server.input, index);
		return { name: configuredName(server, index), index, server };
	});

	const identities = new Map<string, ConfiguredTarget>();
	for (const target of targets) {
		const identity = normalizedIdentity(target.name);
		const previous = identities.get(identity);
		if (previous) {
			throw configurationError(
				"CONFIG_TARGET_NAME_CONFLICT",
				`Configured target names ${previous.name} and ${target.name} conflict after identity normalization.`,
				["servers", target.index, "name"],
				"Give every OpenAPI target a stable, case-insensitively unique name.",
			);
		}
		identities.set(identity, target);
	}

	const requested =
		requestedTargets === undefined
			? []
			: Array.isArray(requestedTargets)
				? requestedTargets
				: [requestedTargets];
	if (requested.length === 0) return targets;
	const selectedIdentities = new Set<string>();
	for (const requestedTarget of requested) {
		if (typeof requestedTarget !== "string" || requestedTarget.length === 0) {
			throw configurationError(
				"CONFIG_TARGET_REQUEST_INVALID",
				"Requested target names must be non-empty strings.",
			);
		}
		const identity = normalizedIdentity(requestedTarget);
		const target = identities.get(identity);
		if (!target || target.name !== requestedTarget) {
			throw configurationError(
				"CONFIG_TARGET_UNKNOWN",
				`Unknown configured target: ${requestedTarget}.`,
				undefined,
				`Available targets: ${targets.map(({ name }) => name).join(", ") || "(none)"}.`,
			);
		}
		selectedIdentities.add(identity);
	}
	return targets.filter((target) =>
		selectedIdentities.has(normalizedIdentity(target.name)),
	);
}
