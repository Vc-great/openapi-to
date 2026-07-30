import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { lstat, open, opendir } from "node:fs/promises";
import path from "node:path";

import {
	ARTIFACT_MANIFEST_FILENAME,
	createEmptyOperationSelection,
	DEFAULT_MAX_SELECTION_BYTES,
	DEFAULT_MAX_SELECTION_OPERATIONS,
	hashOperationSelection,
	mergeOperationSelection,
	parseOperationSelectionManifest,
	serializeOperationSelectionManifest,
	stateDirectoryName,
	type FileIdentity,
	type OperationCatalog,
	type OperationSelectionManifestV1,
	type OperationSelectionMergeResult,
	type OperationSelectionMutation,
	type OutputFileSnapshot,
} from "@openapi-to/core";
import type {
	TrustedTargetCatalogRegistry,
	CompiledTargetCatalog,
} from "../catalog/trusted-target-registry.ts";
import { McpToolError } from "../errors.ts";
import type { ResolvedMcpServerOptions } from "../options.ts";
import {
	resolveWorkspacePath,
	workspaceRelative,
} from "../security/workspace.ts";
import { prepareTargets, type PreparedTarget } from "./service.ts";
import type { TrustedConfigProvider } from "./trusted-config.ts";

export const OPERATION_SELECTION_DIRECTORY = `${stateDirectoryName}/selections`;

export interface SelectionFileSnapshot extends OutputFileSnapshot {
	path: string;
}

export interface PreparedOperationSelection {
	target: PreparedTarget;
	cached: CompiledTargetCatalog;
	outputRoot: string;
	outputRootIdentity: string;
	selectionOwner: string;
	selectionFile: string;
	selectionFileIdentity: string;
	selectionFileSnapshot: SelectionFileSnapshot;
	previousSelectionExists: boolean;
	previousSelection: OperationSelectionManifestV1;
	previousSelectionHash: string;
	desiredSelectionHash: string;
	desiredSelectionBytes: string;
	merge: OperationSelectionMergeResult;
}

export interface ExpectedOperationSelectionState {
	target: string;
	selectionOwner: string;
	selectionFileIdentity: string;
	selectionFileSnapshot: OutputFileSnapshot;
	previousSelectionHash: string;
}

export interface RevalidatedOperationSelectionState {
	selectionFile: string;
	snapshot: SelectionFileSnapshot;
	semanticHash: string;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function hash(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

function snapshotsEqual(
	left: OutputFileSnapshot,
	right: OutputFileSnapshot,
): boolean {
	return (
		left.exists === right.exists &&
		left.sha256 === right.sha256 &&
		left.bytes === right.bytes &&
		JSON.stringify(left.identity) === JSON.stringify(right.identity)
	);
}

function fileIdentity(metadata: BigIntStats): FileIdentity {
	return {
		device: metadata.dev.toString(),
		inode: metadata.ino.toString(),
		size: metadata.size.toString(),
		modifiedNanoseconds: metadata.mtimeNs.toString(),
	};
}

function selectionOwner(
	configPath: string,
	target: string,
	outputRootIdentity: string,
): string {
	return `target:${target}|config:${hash(configPath)}|output:${hash(outputRootIdentity)}`;
}

function selectionFilename(target: string, owner: string): string {
	const prefix =
		target
			.normalize("NFKC")
			.replace(/[^a-zA-Z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48) || "target";
	return `${prefix}-${hash(owner).slice(0, 16)}.json`;
}

async function assertNoSymlinkSegments(
	workspaceRoot: string,
	candidate: string,
): Promise<void> {
	const relative = path.relative(workspaceRoot, candidate);
	let current = workspaceRoot;
	for (const segment of relative.split(path.sep).filter(Boolean)) {
		current = path.join(current, segment);
		try {
			if ((await lstat(current)).isSymbolicLink()) {
				throw new McpToolError(
					"SELECTION_STATE_INCONSISTENT",
					"Selection state cannot be read through a symbolic link.",
				);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw error;
		}
	}
}

async function nearestExistingDirectoryDevice(
	candidate: string,
): Promise<string> {
	let current = path.resolve(candidate);
	while (true) {
		try {
			const metadata = await lstat(current, { bigint: true });
			if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
				throw new McpToolError(
					"SELECTION_STATE_INCONSISTENT",
					"Selective state must be rooted below a real directory.",
				);
			}
			return metadata.dev.toString();
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			const parent = path.dirname(current);
			if (parent === current) throw error;
			current = parent;
		}
	}
}

async function readSelectionFile(
	workspaceRoot: string,
	filePath: string,
	target: string,
	owner: string,
): Promise<{
	manifest?: OperationSelectionManifestV1;
	snapshot: SelectionFileSnapshot;
}> {
	await resolveWorkspacePath(workspaceRoot, filePath, { mustExist: false });
	await assertNoSymlinkSegments(workspaceRoot, filePath);
	let before: BigIntStats;
	try {
		before = await lstat(filePath, { bigint: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {
				snapshot: {
					path: workspaceRelative(workspaceRoot, filePath),
					exists: false,
				},
			};
		}
		throw error;
	}
	if (!before.isFile() || before.isSymbolicLink() || before.nlink > 1n) {
		throw new McpToolError(
			"SELECTION_STATE_INCONSISTENT",
			"Selection state is not a regular file.",
		);
	}
	if (before.size > BigInt(DEFAULT_MAX_SELECTION_BYTES)) {
		throw new McpToolError(
			"SELECTION_MANIFEST_TOO_LARGE",
			`Selection manifest exceeds the ${DEFAULT_MAX_SELECTION_BYTES} byte limit.`,
		);
	}
	const handle = await open(filePath, "r");
	try {
		const opened = await handle.stat({ bigint: true });
		if (before.dev !== opened.dev || before.ino !== opened.ino) {
			throw new McpToolError(
				"SELECTION_STATE_INCONSISTENT",
				"Selection state changed while it was being opened.",
			);
		}
		const buffer = new Uint8Array(DEFAULT_MAX_SELECTION_BYTES + 1);
		const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0);
		if (bytesRead > DEFAULT_MAX_SELECTION_BYTES) {
			throw new McpToolError(
				"SELECTION_MANIFEST_TOO_LARGE",
				`Selection manifest exceeds the ${DEFAULT_MAX_SELECTION_BYTES} byte limit.`,
			);
		}
		const after = await lstat(filePath, { bigint: true });
		if (
			after.dev !== opened.dev ||
			after.ino !== opened.ino ||
			after.size !== opened.size ||
			after.mtimeNs !== opened.mtimeNs
		) {
			throw new McpToolError(
				"SELECTION_STATE_INCONSISTENT",
				"Selection state changed while it was being read.",
			);
		}
		const content = buffer.slice(0, bytesRead);
		const parsed = parseOperationSelectionManifest(content, {
			expectedTarget: target,
			expectedSelectionOwner: owner,
			maxBytes: DEFAULT_MAX_SELECTION_BYTES,
			maxOperations: DEFAULT_MAX_SELECTION_OPERATIONS,
		});
		const firstError = parsed.diagnostics.find(
			({ severity }) => severity === "error",
		);
		if (!parsed.manifest || firstError) {
			throw new McpToolError(
				firstError?.code ?? "SELECTION_MANIFEST_INVALID",
				firstError?.message ?? "Selection manifest is invalid.",
			);
		}
		return {
			manifest: parsed.manifest,
			snapshot: {
				path: workspaceRelative(workspaceRoot, filePath),
				exists: true,
				sha256: hash(content),
				bytes: bytesRead,
				identity: fileIdentity(after),
			},
		};
	} finally {
		await handle.close();
	}
}

export async function revalidateOperationSelectionState(
	options: ResolvedMcpServerOptions,
	expected: ExpectedOperationSelectionState,
): Promise<RevalidatedOperationSelectionState> {
	const selectionFile = await resolveWorkspacePath(
		options.workspaceRoot,
		expected.selectionFileIdentity,
		{ mustExist: false },
	);
	let current: Awaited<ReturnType<typeof readSelectionFile>>;
	try {
		current = await readSelectionFile(
			options.workspaceRoot,
			selectionFile,
			expected.target,
			expected.selectionOwner,
		);
	} catch {
		throw new McpToolError(
			"SELECTION_CHANGED_SINCE_PREPARE",
			"Selection state became missing, unsafe, or invalid after Prepare; create and approve a new plan.",
		);
	}
	if (!snapshotsEqual(current.snapshot, expected.selectionFileSnapshot)) {
		throw new McpToolError(
			"SELECTION_FILE_SNAPSHOT_MISMATCH",
			"Selection state changed physically after Prepare; create and approve a new plan.",
		);
	}
	const manifest =
		current.manifest ??
		createEmptyOperationSelection(expected.target, expected.selectionOwner);
	const semanticHash = hashOperationSelection(manifest);
	if (semanticHash !== expected.previousSelectionHash) {
		throw new McpToolError(
			"SELECTION_SEMANTIC_HASH_MISMATCH",
			"Selection operations or ownership changed after Prepare; create and approve a new plan.",
		);
	}
	return { selectionFile, snapshot: current.snapshot, semanticHash };
}

async function outputState(
	outputRoot: string,
): Promise<{ exists: boolean; empty: boolean; ownershipExists: boolean }> {
	let metadata: Awaited<ReturnType<typeof lstat>>;
	try {
		metadata = await lstat(outputRoot);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { exists: false, empty: true, ownershipExists: false };
		throw error;
	}
	if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
		throw new McpToolError(
			"SELECTION_STATE_INCONSISTENT",
			"The trusted output root is not a real directory.",
		);
	}
	const ownershipPath = path.join(outputRoot, ARTIFACT_MANIFEST_FILENAME);
	let ownershipExists = false;
	try {
		const ownership = await lstat(ownershipPath);
		if (!ownership.isFile() || ownership.isSymbolicLink()) {
			throw new McpToolError(
				"SELECTION_STATE_INCONSISTENT",
				"The ownership manifest is not a regular file.",
			);
		}
		ownershipExists = true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const directory = await opendir(outputRoot);
	let empty = true;
	try {
		const first = await directory.read();
		empty = first === null;
	} finally {
		await directory.close().catch(() => undefined);
	}
	return { exists: true, empty, ownershipExists };
}

function validateOperationKeys(
	catalog: OperationCatalog,
	operationKeys: readonly string[],
	target: string,
	historical: boolean,
): void {
	const byKey = new Map(catalog.items.map((item) => [item.operationKey, item]));
	const counts = new Map<string, number>();
	for (const item of catalog.items) {
		if (item.operationId)
			counts.set(item.operationId, (counts.get(item.operationId) ?? 0) + 1);
	}
	for (const operationKey of operationKeys) {
		const item = byKey.get(operationKey);
		if (!item) {
			throw new McpToolError(
				"SELECTION_OPERATION_NOT_FOUND",
				`${historical ? "Previously selected" : "Requested"} operationKey ${operationKey} was not found in trusted target ${target}.`,
				historical
					? "Review the OpenAPI operation identity change; selection migration is not automatic."
					: "Search the target and use an exact operationKey.",
			);
		}
		if (!item.operationId) {
			throw new McpToolError(
				"SELECTIVE_PREPARE_OPERATION_ID_REQUIRED",
				`operationKey ${operationKey} cannot be prepared because it has no operationId.`,
			);
		}
		if ((counts.get(item.operationId) ?? 0) > 1) {
			throw new McpToolError(
				"SELECTIVE_PREPARE_DUPLICATE_OPERATION_ID",
				`operationKey ${operationKey} cannot be prepared because operationId ${item.operationId} is duplicated.`,
			);
		}
	}
}

export async function prepareOperationSelection(
	provider: TrustedConfigProvider,
	options: ResolvedMcpServerOptions,
	registry: TrustedTargetCatalogRegistry,
	requestedTargets: string[] | undefined,
	mutation: OperationSelectionMutation,
	signal?: AbortSignal,
): Promise<PreparedOperationSelection> {
	if (mutation.operationKeys.length === 0)
		throw new McpToolError(
			"EMPTY_SELECTION_MUTATION",
			mutation.type === "replace"
				? "Selective Prepare replace requires at least one exact operationKey; clear is not supported."
				: "Selective Prepare requires at least one exact operationKey to add.",
		);
	const prepared = await prepareTargets(
		provider,
		options,
		requestedTargets,
		signal,
	);
	if (prepared.targets.length !== 1) {
		throw new McpToolError(
			"SELECTIVE_PREPARE_SINGLE_TARGET_REQUIRED",
			"Selective Prepare requires exactly one startup-configured target.",
		);
	}
	const target = prepared.targets[0];
	if (!target)
		throw new McpToolError(
			"MCP_UNKNOWN_TARGET",
			"The selected trusted target was not found.",
		);
	const outputRoot = await resolveWorkspacePath(
		options.workspaceRoot,
		target.output.absolutePath,
		{ mustExist: false },
	);
	const outputRootIdentity = workspaceRelative(
		options.workspaceRoot,
		outputRoot,
	);
	const owner = selectionOwner(
		prepared.configPath,
		target.name,
		outputRootIdentity,
	);
	const relativeSelection = path.posix.join(
		OPERATION_SELECTION_DIRECTORY,
		selectionFilename(target.name, owner),
	);
	const selectionFile = await resolveWorkspacePath(
		options.workspaceRoot,
		relativeSelection,
		{ mustExist: false },
	);
	const selectionInsideOutput = path.relative(outputRoot, selectionFile);
	const outputInsideSelectionDirectory = path.relative(
		path.dirname(selectionFile),
		outputRoot,
	);
	if (
		selectionInsideOutput === "" ||
		(!selectionInsideOutput.startsWith(`..${path.sep}`) &&
			selectionInsideOutput !== ".." &&
			!path.isAbsolute(selectionInsideOutput)) ||
		outputInsideSelectionDirectory === "" ||
		(!outputInsideSelectionDirectory.startsWith(`..${path.sep}`) &&
			outputInsideSelectionDirectory !== ".." &&
			!path.isAbsolute(outputInsideSelectionDirectory))
	) {
		throw new McpToolError(
			"SELECTION_STATE_INCONSISTENT",
			"The trusted output root overlaps reserved selection state storage.",
		);
	}
	const [outputDevice, selectionDevice] = await Promise.all([
		nearestExistingDirectoryDevice(outputRoot),
		nearestExistingDirectoryDevice(path.dirname(selectionFile)),
	]);
	if (outputDevice !== selectionDevice) {
		throw new McpToolError(
			"SELECTIVE_STATE_CROSS_DEVICE_UNSUPPORTED",
			"Selective Prepare requires generated output and selection state to be committed on the same filesystem device.",
		);
	}
	const [selection, disk, cached] = await Promise.all([
		readSelectionFile(options.workspaceRoot, selectionFile, target.name, owner),
		outputState(outputRoot),
		registry.get(target.name, signal),
	]);
	if (!cached.success || !cached.catalog || !cached.compilation.document) {
		throw new McpToolError(
			"MCP_TOOL_EXECUTION_FAILED",
			`Trusted target ${target.name} could not be compiled for Selective Prepare.`,
		);
	}

	if (!selection.manifest && disk.ownershipExists) {
		throw new McpToolError(
			"SELECTION_BOOTSTRAP_REQUIRED",
			"An ownership manifest exists without selection state; explicit migration is required before Selective Prepare.",
		);
	}
	if (!selection.manifest && !disk.empty) {
		throw new McpToolError(
			"SELECTION_BOOTSTRAP_REQUIRED",
			"The output root is not empty and has no selection state; ownership cannot be inferred safely.",
		);
	}
	if (selection.manifest && !disk.ownershipExists && !disk.empty) {
		throw new McpToolError(
			"SELECTION_STATE_INCONSISTENT",
			"Selection state exists but the non-empty output root has no ownership manifest.",
		);
	}

	const previousSelection =
		selection.manifest ?? createEmptyOperationSelection(target.name, owner);
	validateOperationKeys(
		cached.catalog,
		previousSelection.operations,
		target.name,
		true,
	);
	const requestedOperationKeys = [...new Set(mutation.operationKeys)].sort(
		compareText,
	);
	validateOperationKeys(
		cached.catalog,
		requestedOperationKeys,
		target.name,
		false,
	);
	const merge = mergeOperationSelection(previousSelection, {
		type: mutation.type,
		operationKeys: requestedOperationKeys,
	});
	if (merge.desiredOperationKeys.length > DEFAULT_MAX_SELECTION_OPERATIONS) {
		throw new McpToolError(
			"SELECTION_MANIFEST_TOO_LARGE",
			`Desired selection exceeds the ${DEFAULT_MAX_SELECTION_OPERATIONS} operation limit.`,
		);
	}
	const desiredSelectionBytes = serializeOperationSelectionManifest(
		merge.manifest,
	);
	if (
		new TextEncoder().encode(desiredSelectionBytes).byteLength >
		DEFAULT_MAX_SELECTION_BYTES
	) {
		throw new McpToolError(
			"SELECTION_MANIFEST_TOO_LARGE",
			`Desired selection exceeds the ${DEFAULT_MAX_SELECTION_BYTES} byte limit.`,
		);
	}
	return {
		target,
		cached,
		outputRoot,
		outputRootIdentity,
		selectionOwner: owner,
		selectionFile,
		selectionFileIdentity: relativeSelection,
		selectionFileSnapshot: selection.snapshot,
		previousSelectionExists: selection.manifest !== undefined,
		previousSelection,
		previousSelectionHash: hashOperationSelection(previousSelection),
		desiredSelectionHash: hashOperationSelection(merge.manifest),
		desiredSelectionBytes,
		merge,
	};
}
