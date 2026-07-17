// @ts-check

import { createHash } from "node:crypto";
import { lstat, readFile, realpath, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** @typedef {{ path: string, bytes: number, sha256: string }} Entry */
/** @typedef {{ format: 1, entries: Entry[] }} Manifest */
/** @typedef {{ maxFiles: number, maxFileBytes: number, maxTotalBytes: number, maxDepth: number, maxManifestBytes: number, maxManifestEntries: number }} Limits */
/** @typedef {{ root: string, manifest?: string, writeManifest?: string, allowEmpty: string[], limits: Limits, help: boolean }} Options */
/** @typedef {{ entries: Entry[], exactPaths: Set<string>, foldedPaths: Map<string, string>, totalBytes: number }} ScanState */

export const DEFAULT_LIMITS = Object.freeze({
	maxFiles: 20_000,
	maxFileBytes: 20 * 1024 * 1024,
	maxTotalBytes: 250 * 1024 * 1024,
	maxDepth: 64,
	maxManifestBytes: 10 * 1024 * 1024,
	maxManifestEntries: 50_000,
});

const MAX_MANIFEST_JSON_DEPTH = 16;
const VALUE_FLAGS = new Set([
	"--root",
	"--manifest",
	"--write-manifest",
	"--allow-empty",
	"--max-files",
	"--max-file-bytes",
	"--max-total-bytes",
	"--max-depth",
	"--max-manifest-bytes",
	"--max-manifest-entries",
]);
const LIMIT_FLAGS = new Map([
	["--max-files", "maxFiles"],
	["--max-file-bytes", "maxFileBytes"],
	["--max-total-bytes", "maxTotalBytes"],
	["--max-depth", "maxDepth"],
	["--max-manifest-bytes", "maxManifestBytes"],
	["--max-manifest-entries", "maxManifestEntries"],
]);

const usage = `Usage:
  node verify-generated-output.mjs --root <generated-root>
    [--manifest <first-run-manifest.json>]
    [--write-manifest <new-manifest.json>]
    [--allow-empty <relative-glob>]...
    [--max-files <positive-integer>]
    [--max-file-bytes <positive-integer>]
    [--max-total-bytes <positive-integer>]
    [--max-depth <positive-integer>]
    [--max-manifest-bytes <positive-integer>]
    [--max-manifest-entries <positive-integer>]

The generated root must be a real child directory of the current repository.
Manifest files may be in the repository or OS temporary directory, but never
inside generated output. Existing manifests are never overwritten. Empty files
fail unless a narrow, explicit --allow-empty glob matches their relative path.`;

/** @param {string} left @param {string} right */
function compareText(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {unknown} error @param {string} code */
function hasErrorCode(error, code) {
	return error instanceof Error && "code" in error && error.code === code;
}

/** @param {string} flag @param {string} value */
function parsePositiveInteger(flag, value) {
	if (!/^[1-9][0-9]*$/.test(value)) {
		throw new Error(`${flag} must be a positive integer.`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`${flag} exceeds the safe integer range.`);
	}
	return parsed;
}

/** @param {string[]} argv @returns {Options} */
export function parseArgs(argv) {
	if (argv.includes("--help") || argv.includes("-h")) {
		return {
			root: "",
			allowEmpty: [],
			limits: { ...DEFAULT_LIMITS },
			help: true,
		};
	}

	/** @type {Map<string, string>} */
	const values = new Map();
	/** @type {string[]} */
	const allowEmpty = [];
	for (let index = 0; index < argv.length; index += 1) {
		const flag = argv[index];
		if (!flag || !VALUE_FLAGS.has(flag)) {
			throw new Error(`Unknown argument: ${flag ?? "<missing>"}\n${usage}`);
		}
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new Error(`Missing value for ${flag}.\n${usage}`);
		}
		if (flag === "--allow-empty") {
			validateAllowEmptyPattern(value);
			allowEmpty.push(value);
		} else {
			if (values.has(flag)) {
				throw new Error(`Duplicate argument: ${flag}`);
			}
			values.set(flag, value);
		}
		index += 1;
	}

	const root = values.get("--root");
	if (!root) {
		throw new Error(`--root is required.\n${usage}`);
	}
	if (values.has("--manifest") && values.has("--write-manifest")) {
		throw new Error("Use --manifest and --write-manifest in separate runs.");
	}

	/** @type {Limits} */
	const limits = { ...DEFAULT_LIMITS };
	for (const [flag, property] of LIMIT_FLAGS) {
		const value = values.get(flag);
		if (value) {
			limits[/** @type {keyof Limits} */ (property)] = parsePositiveInteger(flag, value);
		}
	}

	return {
		root,
		manifest: values.get("--manifest"),
		writeManifest: values.get("--write-manifest"),
		allowEmpty,
		limits,
		help: false,
	};
}

/** @param {string} parent @param {string} child */
function isInside(parent, child) {
	const relative = path.relative(parent, child);
	return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** @param {string} parent @param {string} child */
function isWithinOrEqual(parent, child) {
	return parent === child || isInside(parent, child);
}

/** @param {string} value @param {string} label */
function validatePosixRelativePath(value, label) {
	if (value.length === 0 || value === ".") {
		throw new Error(`${label} must not be empty or '.'.`);
	}
	if (value.includes("\\")) {
		throw new Error(`${label} must use POSIX '/' separators: ${value}`);
	}
	if (value.includes("\0") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
		throw new Error(`${label} must be a relative path: ${value}`);
	}
	const segments = value.split("/");
	if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
		throw new Error(`${label} is not normalized: ${value}`);
	}
	if (path.posix.normalize(value) !== value) {
		throw new Error(`${label} is not a canonical POSIX path: ${value}`);
	}
}

/** @param {string} pattern */
function validateAllowEmptyPattern(pattern) {
	validatePosixRelativePath(pattern, "--allow-empty pattern");
	if (/[[\]{}]/.test(pattern)) {
		throw new Error(`--allow-empty supports only '*', '**', and '?' wildcards: ${pattern}`);
	}
	if (pattern.split("/").some((segment) => segment.includes("**") && segment !== "**")) {
		throw new Error(`'**' must be a complete path segment in --allow-empty: ${pattern}`);
	}
	const literal = pattern.replace(/[*/?]/g, "");
	if (literal.length === 0 || ["*", "**", "**/*", "*/**", "**/**"].includes(pattern)) {
		throw new Error(`--allow-empty pattern is too broad: ${pattern}`);
	}
}

/** @param {string} value */
function escapeRegex(value) {
	return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/** @param {string} pattern */
function globToRegExp(pattern) {
	const segments = pattern.split("/");
	let source = "^";
	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index];
		if (segment === "**") {
			source += index === segments.length - 1 ? "(?:[^/]+(?:/[^/]+)*)?" : "(?:[^/]+/)*";
			continue;
		}
		for (const character of segment) {
			if (character === "*") source += "[^/]*";
			else if (character === "?") source += "[^/]";
			else source += escapeRegex(character);
		}
		if (index < segments.length - 1) source += "/";
	}
	return new RegExp(`${source}$`);
}

/** @param {string} rawRoot */
async function assertGeneratedRoot(rawRoot) {
	const repository = await realpath(process.cwd());
	const resolved = path.resolve(rawRoot);
	const unresolvedStat = await lstat(resolved);
	if (unresolvedStat.isSymbolicLink()) {
		throw new Error(`Generated root must not be a symlink: ${resolved}`);
	}
	if (!unresolvedStat.isDirectory()) {
		throw new Error(`Generated root is not a directory: ${rawRoot}`);
	}
	const root = await realpath(resolved);
	if (!isInside(repository, root)) {
		throw new Error(`Generated root must be a child of the repository: ${root}`);
	}
	return { root, repository, temporaryRoot: await realpath(tmpdir()) };
}

/** @param {string} candidate @param {string} repository @param {string} temporaryRoot @param {string} label */
function assertAllowedManifestLocation(candidate, repository, temporaryRoot, label) {
	if (!isWithinOrEqual(repository, candidate) && !isWithinOrEqual(temporaryRoot, candidate)) {
		throw new Error(`${label} must be in the repository or OS temporary directory: ${candidate}`);
	}
}

/** @param {string} text @param {string} filePath */
function assertJsonDepth(text, filePath) {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (const character of text) {
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') inString = true;
		else if (character === "{" || character === "[") {
			depth += 1;
			if (depth > MAX_MANIFEST_JSON_DEPTH) {
				throw new Error(`Manifest JSON exceeds maximum depth ${MAX_MANIFEST_JSON_DEPTH}: ${filePath}`);
			}
		} else if (character === "}" || character === "]") {
			depth -= 1;
		}
	}
}

/** @param {unknown} value */
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} label */
function assertOnlyKeys(value, allowed, label) {
	const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
	if (unexpected.length > 0) {
		throw new Error(`${label} contains unsupported field(s): ${unexpected.sort(compareText).join(", ")}`);
	}
}

/** @param {unknown} value @param {string} filePath @param {Limits} limits @returns {Manifest} */
export function validateManifest(value, filePath, limits) {
	if (!isRecord(value)) {
		throw new Error(`Manifest must be a JSON object: ${filePath}`);
	}
	const candidate = /** @type {Record<string, unknown>} */ (value);
	assertOnlyKeys(candidate, ["format", "entries"], "Manifest");
	if (candidate.format !== 1) {
		throw new Error(`Manifest format must equal 1: ${filePath}`);
	}
	if (!Array.isArray(candidate.entries)) {
		throw new Error(`Manifest entries must be an array: ${filePath}`);
	}
	if (candidate.entries.length > limits.maxManifestEntries || candidate.entries.length > limits.maxFiles) {
		throw new Error(`Manifest entry count ${candidate.entries.length} exceeds the configured limit.`);
	}

	const exactPaths = new Set();
	/** @type {Map<string, string>} */
	const foldedPaths = new Map();
	/** @type {Entry[]} */
	const entries = [];
	let totalBytes = 0;
	for (let index = 0; index < candidate.entries.length; index += 1) {
		const rawEntry = candidate.entries[index];
		if (!isRecord(rawEntry)) {
			throw new Error(`Manifest entry ${index} must be an object: ${filePath}`);
		}
		const entry = /** @type {Record<string, unknown>} */ (rawEntry);
		assertOnlyKeys(entry, ["path", "bytes", "sha256"], `Manifest entry ${index}`);
		if (typeof entry.path !== "string") {
			throw new Error(`Manifest entry ${index} path must be a string: ${filePath}`);
		}
		validatePosixRelativePath(entry.path, `Manifest entry ${index} path`);
		if (exactPaths.has(entry.path)) {
			throw new Error(`Duplicate manifest path: ${entry.path}`);
		}
		const folded = entry.path.toLowerCase();
		const previous = foldedPaths.get(folded);
		if (previous && previous !== entry.path) {
			throw new Error(`Case-insensitive manifest path collision: ${previous} and ${entry.path}`);
		}
		exactPaths.add(entry.path);
		foldedPaths.set(folded, entry.path);

		if (!Number.isSafeInteger(entry.bytes) || /** @type {number} */ (entry.bytes) < 0) {
			throw new Error(`Manifest entry ${index} bytes must be a non-negative safe integer: ${filePath}`);
		}
		if (/** @type {number} */ (entry.bytes) > limits.maxFileBytes) {
			throw new Error(`Manifest entry ${index} bytes exceed --max-file-bytes: ${entry.path}`);
		}
		totalBytes += /** @type {number} */ (entry.bytes);
		if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxTotalBytes) {
			throw new Error(`Manifest total bytes exceed --max-total-bytes: ${filePath}`);
		}
		if (typeof entry.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(entry.sha256)) {
			throw new Error(`Manifest entry ${index} sha256 must be exactly 64 hexadecimal characters: ${filePath}`);
		}

		entries.push({
			path: entry.path,
			bytes: /** @type {number} */ (entry.bytes),
			sha256: entry.sha256.toLowerCase(),
		});
	}
	return { format: 1, entries };
}

/** @param {string} rawPath @param {string} repository @param {string} temporaryRoot @param {string} generatedRoot @param {Limits} limits */
async function readManifest(rawPath, repository, temporaryRoot, generatedRoot, limits) {
	const resolved = path.resolve(rawPath);
	const unresolvedStat = await lstat(resolved);
	if (unresolvedStat.isSymbolicLink()) {
		throw new Error(`Manifest must not be a symlink: ${resolved}`);
	}
	if (!unresolvedStat.isFile()) {
		throw new Error(`Manifest is not a regular file: ${resolved}`);
	}
	if (unresolvedStat.size > limits.maxManifestBytes) {
		throw new Error(`Manifest exceeds --max-manifest-bytes (${limits.maxManifestBytes}): ${resolved}`);
	}
	const manifestPath = await realpath(resolved);
	assertAllowedManifestLocation(manifestPath, repository, temporaryRoot, "Manifest");
	if (isInside(generatedRoot, manifestPath)) {
		throw new Error(`Manifest must not be inside generated output: ${manifestPath}`);
	}
	const text = await readFile(manifestPath, "utf8");
	assertJsonDepth(text, manifestPath);
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error(`Manifest contains invalid JSON: ${manifestPath}`);
	}
	return validateManifest(parsed, manifestPath, limits);
}

/** @param {string} root @param {RegExp[]} allowEmpty @param {Limits} limits @param {ScanState} state @param {string} [directory] @param {number} [depth] */
async function scanDirectory(root, allowEmpty, limits, state, directory = root, depth = 0) {
	if (depth > limits.maxDepth) {
		throw new Error(`Generated output exceeds --max-depth (${limits.maxDepth}): ${path.relative(root, directory)}`);
	}
	const names = (await readdir(directory)).sort(compareText);
	for (const name of names) {
		const absolute = path.join(directory, name);
		const stat = await lstat(absolute);
		const relative = path.relative(root, absolute).split(path.sep).join("/");
		if (stat.isSymbolicLink()) {
			throw new Error(`Symlink found in generated output: ${relative}`);
		}
		if (stat.isDirectory()) {
			await scanDirectory(root, allowEmpty, limits, state, absolute, depth + 1);
			continue;
		}
		if (!stat.isFile()) {
			throw new Error(`Unsupported filesystem entry: ${relative}`);
		}

		validatePosixRelativePath(relative, "Generated path");
		if (state.exactPaths.has(relative)) {
			throw new Error(`Duplicate generated path: ${relative}`);
		}
		const folded = relative.toLowerCase();
		const previous = state.foldedPaths.get(folded);
		if (previous && previous !== relative) {
			throw new Error(`Case-insensitive path collision: ${previous} and ${relative}`);
		}
		if (state.entries.length + 1 > limits.maxFiles || state.entries.length + 1 > limits.maxManifestEntries) {
			throw new Error(`Generated file count exceeds the configured limit at: ${relative}`);
		}
		if (stat.size > limits.maxFileBytes) {
			throw new Error(`Generated file exceeds --max-file-bytes (${limits.maxFileBytes}): ${relative}`);
		}
		if (!Number.isSafeInteger(state.totalBytes + stat.size) || state.totalBytes + stat.size > limits.maxTotalBytes) {
			throw new Error(`Generated output exceeds --max-total-bytes (${limits.maxTotalBytes}) at: ${relative}`);
		}
		if (stat.size === 0 && !allowEmpty.some((pattern) => pattern.test(relative))) {
			throw new Error(`Empty generated file: ${relative}`);
		}

		const content = await readFile(absolute);
		if (content.byteLength !== stat.size) {
			throw new Error(`Generated file changed while scanning: ${relative}`);
		}
		if (content.byteLength > limits.maxFileBytes || state.totalBytes + content.byteLength > limits.maxTotalBytes) {
			throw new Error(`Generated file exceeded configured byte limits while scanning: ${relative}`);
		}
		state.exactPaths.add(relative);
		state.foldedPaths.set(folded, relative);
		state.totalBytes += content.byteLength;
		state.entries.push({
			path: relative,
			bytes: content.byteLength,
			sha256: createHash("sha256").update(content).digest("hex"),
		});
	}
}

/** @param {string} root @param {string[]} allowEmptyPatterns @param {Limits} limits @returns {Promise<Manifest>} */
async function buildManifest(root, allowEmptyPatterns, limits) {
	/** @type {ScanState} */
	const state = {
		entries: [],
		exactPaths: new Set(),
		foldedPaths: new Map(),
		totalBytes: 0,
	};
	await scanDirectory(root, allowEmptyPatterns.map(globToRegExp), limits, state);
	if (state.entries.length === 0) {
		throw new Error(`Generated output is empty: ${root}`);
	}
	state.entries.sort((left, right) => compareText(left.path, right.path));
	return { format: 1, entries: state.entries };
}

/** @param {Manifest} expected @param {Manifest} actual */
function compare(expected, actual) {
	const expectedByPath = new Map(expected.entries.map((entry) => [entry.path, entry]));
	const actualByPath = new Map(actual.entries.map((entry) => [entry.path, entry]));
	/** @type {string[]} */
	const differences = [];
	for (const [filePath, entry] of expectedByPath) {
		const current = actualByPath.get(filePath);
		if (!current) differences.push(`deleted: ${filePath}`);
		else if (current.bytes !== entry.bytes || current.sha256 !== entry.sha256) differences.push(`changed: ${filePath}`);
	}
	for (const filePath of actualByPath.keys()) {
		if (!expectedByPath.has(filePath)) differences.push(`added: ${filePath}`);
	}
	return differences.sort(compareText);
}

/** @param {string} rawPath @param {Manifest} manifest @param {string} repository @param {string} temporaryRoot @param {string} generatedRoot @param {Limits} limits */
async function writeNewManifest(rawPath, manifest, repository, temporaryRoot, generatedRoot, limits) {
	const resolved = path.resolve(rawPath);
	try {
		await lstat(resolved);
		throw new Error(`Manifest already exists and will not be overwritten: ${resolved}`);
	} catch (error) {
		if (!hasErrorCode(error, "ENOENT")) throw error;
	}
	const parent = await realpath(path.dirname(resolved));
	const destination = path.join(parent, path.basename(resolved));
	assertAllowedManifestLocation(destination, repository, temporaryRoot, "Manifest destination");
	if (isInside(generatedRoot, destination)) {
		throw new Error(`Manifest destination must not be inside generated output: ${destination}`);
	}
	const text = `${JSON.stringify(manifest, null, 2)}\n`;
	if (Buffer.byteLength(text) > limits.maxManifestBytes) {
		throw new Error(`Manifest output exceeds --max-manifest-bytes (${limits.maxManifestBytes}): ${destination}`);
	}
	await writeFile(destination, text, { flag: "wx" });
	console.log(`Wrote manifest: ${destination}`);
}

export async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	if (options.help) {
		console.log(usage);
		return;
	}
	const { root, repository, temporaryRoot } = await assertGeneratedRoot(options.root);
	const actual = await buildManifest(root, options.allowEmpty, options.limits);

	if (options.writeManifest) {
		await writeNewManifest(options.writeManifest, actual, repository, temporaryRoot, root, options.limits);
	}
	if (options.manifest) {
		const expected = await readManifest(options.manifest, repository, temporaryRoot, root, options.limits);
		const differences = compare(expected, actual);
		if (differences.length > 0) {
			throw new Error(`Generated output differs from the manifest:\n${differences.join("\n")}`);
		}
		console.log(`Manifest matches: ${actual.entries.length} file(s)`);
		return;
	}
	console.log(`Verified generated output: ${actual.entries.length} file(s)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
