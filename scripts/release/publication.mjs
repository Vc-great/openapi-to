import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import {
	access,
	lstat,
	readdir,
	readFile,
	realpath,
	unlink,
	writeFile,
} from "node:fs/promises";
import {
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
	sep,
} from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import semver from "semver";

export const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

const ALLOWED_CHANNELS = new Set(["rc", "latest"]);
const MAX_REGISTRY_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_ATTEMPTS = 12;
const MAX_DELAY_MS = 30_000;
const MAX_REQUEST_TIMEOUT_MS = 30_000;
const MAX_TOTAL_VERIFY_MS = 180_000;
const execFileAsync = promisify(execFile);

class PublicationError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

async function exists(path) {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function readJson(path, code) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		throw new PublicationError(
			code,
			`Unable to read valid JSON required by ${code}.`,
		);
	}
}

function parseWorkspacePatterns(contents) {
	return contents
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*-\s*['"]([^'"]+)['"]\s*$/)?.[1])
		.filter(Boolean);
}

async function expandWorkspacePattern(root, pattern) {
	if (
		!/^[-A-Za-z0-9_.]+(?:\/[-A-Za-z0-9_.]+)*(?:\/\*)?$/.test(pattern) ||
		pattern.split("/").includes("..")
	) {
		throw new PublicationError(
			"UNSAFE_WORKSPACE_PATTERN",
			`Workspace pattern ${pattern} is not a safe repository-relative path.`,
		);
	}
	if (!pattern.endsWith("/*")) {
		return (await exists(join(root, pattern, "package.json"))) ? [pattern] : [];
	}
	const parent = pattern.slice(0, -2);
	const parentPath = join(root, parent);
	if (!(await exists(parentPath))) return [];
	const directories = [];
	for (const entry of (
		await readdir(parentPath, { withFileTypes: true })
	).sort((left, right) => left.name.localeCompare(right.name))) {
		if (
			entry.isDirectory() &&
			(await exists(join(parentPath, entry.name, "package.json")))
		) {
			directories.push(`${parent}/${entry.name}`);
		}
	}
	return directories;
}

function isInside(root, target) {
	const repositoryRelative = relative(root, target);
	return (
		repositoryRelative === "" ||
		(repositoryRelative !== ".." &&
			!repositoryRelative.startsWith(`..${sep}`) &&
			!isAbsolute(repositoryRelative))
	);
}

export async function readWorkspacePackages(root = repositoryRoot) {
	const rootManifest = await readJson(
		join(root, "package.json"),
		"INVALID_ROOT_MANIFEST",
	);
	const pnpmPatterns = parseWorkspacePatterns(
		await readFile(join(root, "pnpm-workspace.yaml"), "utf8"),
	);
	const rootPatterns = [...(rootManifest.workspaces?.packages ?? [])];
	if (
		JSON.stringify([...pnpmPatterns].sort()) !==
		JSON.stringify([...rootPatterns].sort())
	) {
		throw new PublicationError(
			"WORKSPACE_PATTERN_MISMATCH",
			"Root workspaces and pnpm-workspace.yaml must select the same packages.",
		);
	}

	const directories = [];
	for (const pattern of pnpmPatterns) {
		const matches = await expandWorkspacePattern(root, pattern);
		if (matches.length === 0) {
			throw new PublicationError(
				"EMPTY_WORKSPACE_PATTERN",
				`Workspace pattern ${pattern} does not contain a package manifest.`,
			);
		}
		directories.push(...matches);
	}
	const packages = [];
	const realRoot = await realpath(root);
	for (const directory of [...new Set(directories)].sort()) {
		const packageDirectory = resolve(root, directory);
		if (!isInside(root, packageDirectory)) {
			throw new PublicationError(
				"WORKSPACE_PATH_ESCAPE",
				`Workspace package ${directory} escapes the repository root.`,
			);
		}
		if (
			(await lstat(packageDirectory)).isSymbolicLink() ||
			!isInside(realRoot, await realpath(packageDirectory))
		) {
			throw new PublicationError(
				"WORKSPACE_SYMLINK_ESCAPE",
				`Workspace package ${directory} must be a real directory inside the repository.`,
			);
		}
		const manifest = await readJson(
			join(packageDirectory, "package.json"),
			"INVALID_PACKAGE_MANIFEST",
		);
		packages.push({ directory, manifest });
	}
	return packages.sort((left, right) =>
		left.manifest.name.localeCompare(right.manifest.name),
	);
}

function validateFixedGroup(config, publicNames) {
	if (!Array.isArray(config.fixed)) {
		throw new PublicationError(
			"INVALID_FIXED_GROUP",
			"Changesets fixed groups must be an array.",
		);
	}
	const expected = [...publicNames].sort();
	const matchingGroups = config.fixed.filter(
		(group) =>
			Array.isArray(group) &&
			new Set(group).size === group.length &&
			JSON.stringify([...group].sort()) === JSON.stringify(expected),
	);
	if (matchingGroups.length !== 1 || config.fixed.length !== 1) {
		throw new PublicationError(
			"PUBLIC_FIXED_GROUP_MISMATCH",
			"All public workspace packages must form one exact Changesets fixed group.",
		);
	}
}

function validateVersionChannel(version, channel, preState) {
	const parsed = semver.parse(version);
	if (!parsed || semver.valid(version) !== version) {
		throw new PublicationError(
			"INVALID_EXPECTED_VERSION",
			`Expected version ${version} must be an exact SemVer value.`,
		);
	}
	const prerelease = parsed.prerelease.length > 0;
	if (prerelease) {
		if (channel !== "rc" || parsed.prerelease[0] !== "rc") {
			throw new PublicationError(
				"CHANNEL_VERSION_MISMATCH",
				`Prerelease version ${version} requires the rc channel and rc identifier.`,
			);
		}
		if (preState?.mode !== "pre" || preState?.tag !== "rc") {
			throw new PublicationError(
				"PRERELEASE_STATE_MISMATCH",
				`Version ${version} requires Changesets prerelease mode with tag rc.`,
			);
		}
	} else {
		if (channel !== "latest") {
			throw new PublicationError(
				"CHANNEL_VERSION_MISMATCH",
				`Stable version ${version} requires the latest channel.`,
			);
		}
		if (preState?.mode === "pre") {
			throw new PublicationError(
				"PRERELEASE_STATE_MISMATCH",
				`Stable version ${version} cannot publish while Changesets remains in prerelease mode.`,
			);
		}
	}
	return prerelease;
}

export async function verifyWorkflowSha({
	expectedSha,
	githubSha,
	githubRef,
	resolveRemoteSha = async () => {
		const { stdout } = await execFileAsync(
			"git",
			["rev-parse", "refs/remotes/origin/main"],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
			},
		);
		return stdout.trim();
	},
} = {}) {
	if (!/^[0-9a-f]{40}$/.test(expectedSha ?? "")) {
		throw new PublicationError(
			"INVALID_EXPECTED_SHA",
			"expected_sha must be a full lowercase commit SHA.",
		);
	}
	if (githubRef !== "refs/heads/main") {
		throw new PublicationError(
			"INVALID_PUBLICATION_REF",
			"Publication must be dispatched from refs/heads/main.",
		);
	}
	if (githubSha !== expectedSha) {
		throw new PublicationError(
			"DISPATCH_SHA_MISMATCH",
			"expected_sha does not match the dispatch commit.",
		);
	}
	let remoteMain;
	try {
		remoteMain = await resolveRemoteSha();
	} catch {
		throw new PublicationError(
			"REMOTE_MAIN_UNAVAILABLE",
			"Unable to resolve the fetched origin/main commit.",
		);
	}
	if (remoteMain !== expectedSha) {
		throw new PublicationError(
			"REMOTE_MAIN_SHA_MISMATCH",
			"expected_sha is not the current fetched origin/main commit.",
		);
	}
	return {
		success: true,
		expectedSha,
		githubRef,
		remoteMain,
	};
}

export async function createPublicationFacts({
	root = repositoryRoot,
	expectedVersion,
	channel,
} = {}) {
	if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
		throw new PublicationError(
			"MISSING_EXPECTED_VERSION",
			"An exact expected version is required.",
		);
	}
	if (!ALLOWED_CHANNELS.has(channel)) {
		throw new PublicationError(
			"INVALID_CHANNEL",
			`Channel ${channel ?? "<missing>"} must be rc or latest.`,
		);
	}

	const workspaces = await readWorkspacePackages(root);
	const publicPackages = workspaces.filter(
		({ manifest }) => manifest.private !== true,
	);
	if (publicPackages.length === 0) {
		throw new PublicationError(
			"NO_PUBLIC_PACKAGES",
			"No public workspace packages were discovered.",
		);
	}
	const publicNames = publicPackages.map(({ manifest }) => manifest.name);
	if (
		publicNames.some(
			(name) => typeof name !== "string" || name.trim().length === 0,
		)
	) {
		throw new PublicationError(
			"INVALID_PACKAGE_NAME",
			"Every public package must have a non-empty name.",
		);
	}
	const versions = new Set(
		publicPackages.map(({ manifest }) => manifest.version),
	);
	if (versions.size !== 1 || !versions.has(expectedVersion)) {
		throw new PublicationError(
			"PUBLIC_VERSION_MISMATCH",
			`Public packages must all use expected version ${expectedVersion}; found ${[
				...versions,
			]
				.sort()
				.join(", ")}.`,
		);
	}
	for (const { manifest } of publicPackages) {
		if (
			manifest.publishConfig?.access !== "public" ||
			manifest.publishConfig?.registry !== "https://registry.npmjs.org/"
		) {
			throw new PublicationError(
				"INVALID_PUBLISH_CONFIG",
				`${manifest.name}@${expectedVersion} must publish publicly to https://registry.npmjs.org/.`,
			);
		}
	}

	const config = await readJson(
		join(root, ".changeset/config.json"),
		"INVALID_CHANGESET_CONFIG",
	);
	validateFixedGroup(config, publicNames);
	const prePath = join(root, ".changeset/pre.json");
	const preState = (await exists(prePath))
		? await readJson(prePath, "INVALID_PRE_STATE")
		: undefined;
	const prerelease = validateVersionChannel(
		expectedVersion,
		channel,
		preState,
	);

	return {
		success: true,
		version: expectedVersion,
		channel,
		distTag: channel,
		prerelease,
		tag: `v${expectedVersion}`,
		packageCount: publicPackages.length,
		packages: publicPackages.map(({ directory, manifest }) => ({
			name: manifest.name,
			version: manifest.version,
			directory,
		})),
	};
}

function runChangesetsPublish({ root, command, arguments: publishArguments }) {
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(
			command,
			publishArguments,
			{
				cwd: root,
				env: process.env,
				stdio: "inherit",
			},
		);
		child.once("error", rejectRun);
		child.once("exit", (code, signal) => {
			if (code === 0) {
				resolveRun();
				return;
			}
			rejectRun(
				new PublicationError(
					"CHANGESETS_PUBLISH_FAILED",
					`Changesets publication failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`,
				),
			);
		});
	});
}

export async function publishWithChangesetsNpm({
	root = repositoryRoot,
	expectedVersion,
	channel,
	npmVersion,
	readNpmVersion = async () => {
		const { stdout } = await execFileAsync("npm", ["--version"], {
			cwd: root,
			encoding: "utf8",
		});
		return stdout.trim();
	},
	runPublish = runChangesetsPublish,
} = {}) {
	const facts = await createPublicationFacts({
		root,
		expectedVersion,
		channel,
	});
	if (!semver.valid(npmVersion) || npmVersion !== (await readNpmVersion())) {
		throw new PublicationError(
			"NPM_TOOLCHAIN_MISMATCH",
			`Publication requires the exact configured npm CLI ${npmVersion ?? "<missing>"}.`,
		);
	}
	const manifestPath = join(root, "package.json");
	const originalManifest = await readFile(manifestPath, "utf8");
	const manifest = await readJson(manifestPath, "INVALID_ROOT_MANIFEST");
	if (
		typeof manifest.packageManager !== "string" ||
		!manifest.packageManager.startsWith("pnpm@")
	) {
		throw new PublicationError(
			"UNEXPECTED_PACKAGE_MANAGER",
			"Changesets npm publication requires the repository packageManager to be pnpm before adaptation.",
		);
	}

	// Changesets 2.28 selects its publish client from packageManager. It also
	// rejects a custom tag in pre mode and can route "only-pre" packages to
	// latest. The runner checkout is temporary: hide pre.json while explicitly
	// passing the validated rc tag, then restore both files byte-for-byte.
	manifest.packageManager = `npm@${npmVersion}`;
	const preStatePath = join(root, ".changeset/pre.json");
	const originalPreState = facts.prerelease
		? await readFile(preStatePath, "utf8")
		: undefined;
	const publishArguments = [
		"publish",
		"--tag",
		facts.distTag,
		"--no-git-tag",
	];
	try {
		await writeFile(
			manifestPath,
			`${JSON.stringify(manifest, null, "\t")}\n`,
		);
		if (originalPreState !== undefined) await unlink(preStatePath);
		await runPublish({
			root,
			distTag: facts.distTag,
			command: join(root, "node_modules/.bin/changeset"),
			arguments: publishArguments,
		});
	} finally {
		await Promise.all([
			writeFile(manifestPath, originalManifest),
			...(originalPreState === undefined
				? []
				: [writeFile(preStatePath, originalPreState)]),
		]);
	}
	return {
		...facts,
		publisher: "npm",
		npmVersion,
	};
}

async function readRegistryMetadata(response, packageName, version) {
	const declaredLength = Number(response.headers?.get?.("content-length"));
	if (
		Number.isFinite(declaredLength) &&
		declaredLength > MAX_REGISTRY_RESPONSE_BYTES
	) {
		throw new PublicationError(
			"REGISTRY_RESPONSE_TOO_LARGE",
			`${packageName}@${version} registry metadata exceeds the response limit.`,
		);
	}
	const chunks = [];
	let totalBytes = 0;
	if (typeof response.body?.getReader === "function") {
		const reader = response.body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				totalBytes += value.byteLength;
				if (totalBytes > MAX_REGISTRY_RESPONSE_BYTES) {
					await reader.cancel();
					throw new PublicationError(
						"REGISTRY_RESPONSE_TOO_LARGE",
						`${packageName}@${version} registry metadata exceeds the response limit.`,
					);
				}
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
	} else {
		const bytes = new Uint8Array(await response.arrayBuffer());
		totalBytes = bytes.byteLength;
		if (totalBytes > MAX_REGISTRY_RESPONSE_BYTES) {
			throw new PublicationError(
				"REGISTRY_RESPONSE_TOO_LARGE",
				`${packageName}@${version} registry metadata exceeds the response limit.`,
			);
		}
		chunks.push(bytes);
	}
	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new PublicationError(
			"INVALID_REGISTRY_RESPONSE",
			`${packageName}@${version} registry metadata is not valid JSON.`,
		);
	}
}

async function verifyOnePackage({
	packageName,
	version,
	channel,
	registryUrl,
	fetchImpl,
	requestTimeoutMs,
}) {
	try {
		const url = new URL(encodeURIComponent(packageName), registryUrl);
		const response = await fetchImpl(url, {
			headers: { accept: "application/json" },
			redirect: "error",
			signal: AbortSignal.timeout(requestTimeoutMs),
		});
		if (!response.ok) {
			return {
				name: packageName,
				version,
				channel,
				versionPresent: false,
				distTagVersion: null,
				success: false,
				error: `Registry returned HTTP ${response.status}.`,
			};
		}
		const metadata = await readRegistryMetadata(
			response,
			packageName,
			version,
		);
		const versionPresent = Boolean(metadata.versions?.[version]);
		const distTagVersion = metadata["dist-tags"]?.[channel] ?? null;
		return {
			name: packageName,
			version,
			channel,
			versionPresent,
			distTagVersion,
			success: versionPresent && distTagVersion === version,
		};
	} catch (error) {
		return {
			name: packageName,
			version,
			channel,
			versionPresent: false,
			distTagVersion: null,
			success: false,
			error:
				error instanceof PublicationError
					? error.message
					: `${packageName}@${version} registry verification failed.`,
		};
	}
}

export async function verifyRegistry({
	facts,
	registryUrl = "https://registry.npmjs.org/",
	attempts = 6,
	delayMs = 10_000,
	requestTimeoutMs = 10_000,
	fetchImpl = globalThis.fetch,
	sleepImpl = (milliseconds) =>
		new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
	onAttempt = () => {},
} = {}) {
	if (!facts?.success || !Array.isArray(facts.packages)) {
		throw new PublicationError(
			"INVALID_PUBLICATION_FACTS",
			"Validated publication facts are required for registry verification.",
		);
	}
	if (
		!Number.isInteger(attempts) ||
		attempts < 1 ||
		attempts > MAX_ATTEMPTS
	) {
		throw new PublicationError(
			"INVALID_ATTEMPTS",
			`Registry attempts must be an integer from 1 to ${MAX_ATTEMPTS}.`,
		);
	}
	if (
		!Number.isInteger(delayMs) ||
		delayMs < 0 ||
		delayMs > MAX_DELAY_MS
	) {
		throw new PublicationError(
			"INVALID_RETRY_DELAY",
			`Registry retry delay must be an integer from 0 to ${MAX_DELAY_MS} milliseconds.`,
		);
	}
	if (
		!Number.isInteger(requestTimeoutMs) ||
		requestTimeoutMs < 1 ||
		requestTimeoutMs > MAX_REQUEST_TIMEOUT_MS
	) {
		throw new PublicationError(
			"INVALID_REQUEST_TIMEOUT",
			`Registry request timeout must be an integer from 1 to ${MAX_REQUEST_TIMEOUT_MS} milliseconds.`,
		);
	}
	const totalBudgetMs =
		attempts * requestTimeoutMs + (attempts - 1) * delayMs;
	if (totalBudgetMs > MAX_TOTAL_VERIFY_MS) {
		throw new PublicationError(
			"INVALID_VERIFICATION_BUDGET",
			`Registry verification budget must not exceed ${MAX_TOTAL_VERIFY_MS} milliseconds.`,
		);
	}
	if (typeof fetchImpl !== "function") {
		throw new PublicationError(
			"MISSING_REGISTRY_CLIENT",
			"A registry client is required.",
		);
	}

	let packages = [];
	let attemptsUsed = 0;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		attemptsUsed = attempt;
		packages = (
			await Promise.all(
				facts.packages.map(({ name }) =>
					verifyOnePackage({
						packageName: name,
						version: facts.version,
						channel: facts.channel,
						registryUrl,
						fetchImpl,
						requestTimeoutMs,
					}),
				),
			)
		).sort((left, right) => left.name.localeCompare(right.name));
		const verified = packages.filter(({ success }) => success).length;
		onAttempt({ attempt, attempts, verified, total: packages.length });
		if (verified === packages.length) break;
		if (attempt < attempts) await sleepImpl(delayMs);
	}

	const success = packages.every((result) => result.success);
	return {
		success,
		version: facts.version,
		channel: facts.channel,
		distTag: facts.distTag,
		attempts: attemptsUsed,
		requestTimeoutMs,
		totalBudgetMs,
		verifiedPackages: packages.filter(({ success: valid }) => valid).length,
		expectedPackages: packages.length,
		packages,
		recovery: success
			? null
			: {
					state: "PARTIAL_PUBLICATION",
					action:
						"Do not change versions or dist-tags; inspect these facts and rerun only the same authorized SHA/version/channel candidate.",
				},
	};
}

export async function readReleaseNotes({
	root = repositoryRoot,
	version,
} = {}) {
	if (!semver.valid(version)) {
		throw new PublicationError(
			"INVALID_EXPECTED_VERSION",
			`Expected version ${version ?? "<missing>"} must be valid SemVer.`,
		);
	}
	const changelog = await readFile(
		join(root, "packages/openapi/CHANGELOG.md"),
		"utf8",
	);
	const normalized = changelog.replaceAll("\r\n", "\n");
	const heading = `## ${version}`;
	const start = normalized
		.split("\n")
		.findIndex((line) => line.trim() === heading);
	if (start < 0) {
		throw new PublicationError(
			"MISSING_RELEASE_NOTES",
			`openapi-to changelog has no section for ${version}.`,
		);
	}
	const lines = normalized.split("\n");
	const end = lines.findIndex(
		(line, index) => index > start && /^##\s+/.test(line),
	);
	return lines.slice(start, end < 0 ? undefined : end).join("\n").trim();
}

function parseInteger(value, name) {
	if (!/^\d+$/.test(value ?? "")) {
		throw new PublicationError(
			"INVALID_ARGUMENT",
			`${name} must be a non-negative integer.`,
		);
	}
	return Number(value);
}

function parseArguments(argv) {
	const [command, ...argumentsList] = argv;
	if (
		![
			"verify-sha",
			"preflight",
			"publish",
			"verify-registry",
			"release-notes",
		].includes(command)
	) {
		throw new PublicationError(
			"INVALID_COMMAND",
			"Command must be verify-sha, preflight, publish, verify-registry, or release-notes.",
		);
	}
	const options = {
		command,
		root: repositoryRoot,
		attempts: 6,
		delayMs: 10_000,
		requestTimeoutMs: 10_000,
	};
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		const value = argumentsList[index + 1];
		if (argument === "--root" && value) options.root = resolve(value);
		else if (argument === "--expected-version" && value)
			options.expectedVersion = value;
		else if (argument === "--channel" && value) options.channel = value;
		else if (argument === "--expected-sha" && value)
			options.expectedSha = value;
		else if (argument === "--github-sha" && value) options.githubSha = value;
		else if (argument === "--github-ref" && value) options.githubRef = value;
		else if (argument === "--npm-version" && value)
			options.npmVersion = value;
		else if (argument === "--attempts" && value)
			options.attempts = parseInteger(value, "--attempts");
		else if (argument === "--delay-ms" && value)
			options.delayMs = parseInteger(value, "--delay-ms");
		else if (argument === "--timeout-ms" && value)
			options.requestTimeoutMs = parseInteger(value, "--timeout-ms");
		else {
			throw new PublicationError(
				"INVALID_ARGUMENT",
				`Unknown or incomplete argument: ${argument}`,
			);
		}
		index += 1;
	}
	return options;
}

export async function main(argv = process.argv.slice(2)) {
	try {
		const options = parseArguments(argv);
		if (options.command === "verify-sha") {
			const result = await verifyWorkflowSha({
				expectedSha: options.expectedSha,
				githubSha: options.githubSha,
				githubRef: options.githubRef,
			});
			process.stdout.write(`${JSON.stringify(result)}\n`);
			return;
		}
		if (options.command === "publish") {
			const result = await publishWithChangesetsNpm({
				root: options.root,
				expectedVersion: options.expectedVersion,
				channel: options.channel,
				npmVersion: options.npmVersion,
			});
			process.stdout.write(`${JSON.stringify(result)}\n`);
			return;
		}
		if (options.command === "release-notes") {
			const notes = await readReleaseNotes({
				root: options.root,
				version: options.expectedVersion,
			});
			process.stdout.write(
				`${JSON.stringify({
					success: true,
					version: options.expectedVersion,
					notes,
				})}\n`,
			);
			return;
		}

		const facts = await createPublicationFacts({
			root: options.root,
			expectedVersion: options.expectedVersion,
			channel: options.channel,
		});
		if (options.command === "preflight") {
			process.stdout.write(`${JSON.stringify(facts)}\n`);
			return;
		}
		const result = await verifyRegistry({
			facts,
			attempts: options.attempts,
			delayMs: options.delayMs,
			requestTimeoutMs: options.requestTimeoutMs,
			onAttempt: ({ attempt, attempts, verified, total }) => {
				process.stderr.write(
					`Registry verification attempt ${attempt}/${attempts}: ${verified}/${total} packages verified.\n`,
				);
			},
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		if (!result.success) process.exitCode = 1;
	} catch (error) {
		const code = error?.code ?? "PUBLICATION_CHECK_FAILED";
		const message =
			error instanceof PublicationError
				? error.message
				: "Publication validation failed.";
		process.stdout.write(
			`${JSON.stringify({ success: false, error: { code, message } })}\n`,
		);
		process.exitCode = code === "INVALID_COMMAND" || code === "INVALID_ARGUMENT" ? 2 : 1;
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await main();
