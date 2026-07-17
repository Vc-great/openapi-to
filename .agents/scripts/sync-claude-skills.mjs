// @ts-check

import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CANONICAL_ROOT = ".agents/skills";
const CLAUDE_ROOT = ".claude/skills";
const MIRROR_MANIFEST = ".openapi-to-skill-mirror.json";
const FUTURE_CAPABILITY_PATTERN = /openapi(?:-to)?\s+(?:validate|inspect|diff)|GeneratedArtifact|machine-readable diagnostics/i;

const usage = `Usage:
  node .agents/scripts/sync-claude-skills.mjs [--check]
  node .agents/scripts/sync-claude-skills.mjs --sync

Default/--check validates canonical Skills and reports mirror drift without
writing. --sync copies canonical files, updates the managed mirror manifest,
and removes only stale files recorded by the previous mirror manifest. Unknown
files under .claude/skills are preserved.`;

/** @param {string} left @param {string} right */
function compareText(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {unknown} error @param {string} code */
function hasErrorCode(error, code) {
	return error instanceof Error && "code" in error && error.code === code;
}

/** @param {string} parent @param {string} child */
function isInside(parent, child) {
	const relative = path.relative(parent, child);
	return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** @param {string | Buffer} value */
function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

/** @param {string} filePath */
async function readText(filePath) {
	return readFile(filePath, "utf8");
}

/** @param {string} raw @param {string} label */
function parseQuotedYamlString(raw, label) {
	if (!raw.startsWith('"') || !raw.endsWith('"')) {
		throw new Error(`${label} must be a quoted YAML string.`);
	}
	try {
		const value = JSON.parse(raw);
		if (typeof value !== "string" || value.length === 0) throw new Error("empty");
		return value;
	} catch {
		throw new Error(`${label} contains an invalid quoted YAML string.`);
	}
}

/** @param {string} content @param {string} skillName @param {string} filePath */
function validateSkillFrontmatter(content, skillName, filePath) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) throw new Error(`Invalid SKILL.md frontmatter delimiters: ${filePath}`);
	const fields = new Map();
	for (const line of match[1].split(/\r?\n/)) {
		const separator = line.indexOf(":");
		if (separator <= 0) throw new Error(`Invalid SKILL.md frontmatter line: ${filePath}`);
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1).trim();
		if (!["name", "description"].includes(key) || fields.has(key) || value.length === 0) {
			throw new Error(`Invalid or duplicate SKILL.md frontmatter field '${key}': ${filePath}`);
		}
		fields.set(key, value);
	}
	if (fields.get("name") !== skillName) {
		throw new Error(`SKILL.md name must match directory '${skillName}': ${filePath}`);
	}
	const description = fields.get("description");
	if (!description || description.length > 1024 || /[<>]/.test(description)) {
		throw new Error(`SKILL.md description is invalid: ${filePath}`);
	}
}

/** @param {string} content @param {string} skillName @param {string} filePath */
function validateOpenAiMetadata(content, skillName, filePath) {
	const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
	if (lines[0] !== "interface:") throw new Error(`openai.yaml must contain only an interface mapping: ${filePath}`);
	const fields = new Map();
	for (const line of lines.slice(1)) {
		const match = line.match(/^  ([a-z_]+): (.+)$/);
		if (!match || !["display_name", "short_description", "default_prompt"].includes(match[1]) || fields.has(match[1])) {
			throw new Error(`Invalid or duplicate openai.yaml field: ${filePath}`);
		}
		fields.set(match[1], parseQuotedYamlString(match[2], `${filePath}:${match[1]}`));
	}
	for (const field of ["display_name", "short_description", "default_prompt"]) {
		if (!fields.has(field)) throw new Error(`openai.yaml is missing ${field}: ${filePath}`);
	}
	const shortDescription = fields.get("short_description");
	if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 64) {
		throw new Error(`openai.yaml short_description must contain 25-64 characters: ${filePath}`);
	}
	const defaultPrompt = fields.get("default_prompt");
	if (!defaultPrompt?.includes(`$${skillName}`)) {
		throw new Error(`openai.yaml default_prompt must invoke $${skillName}: ${filePath}`);
	}
	if (FUTURE_CAPABILITY_PATTERN.test(content)) {
		throw new Error(`openai.yaml describes an unavailable future capability: ${filePath}`);
	}
}

/** @param {string} skillRoot @param {string} filePath @param {string} content */
async function validateMarkdownLinks(skillRoot, filePath, content) {
	for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
		const reference = match[1].split("#")[0];
		if (!reference || reference.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(reference)) continue;
		const destination = path.resolve(path.dirname(filePath), reference);
		if (!isInside(skillRoot, destination) && destination !== skillRoot) {
			throw new Error(`Markdown link escapes its Skill: ${filePath} -> ${reference}`);
		}
		try {
			await lstat(destination);
		} catch (error) {
			if (hasErrorCode(error, "ENOENT")) throw new Error(`Broken Markdown link: ${filePath} -> ${reference}`);
			throw error;
		}
	}

	// Validate repository-local Skill/script paths in prose and shell blocks, not
	// only Markdown links. Trim sentence punctuation without trimming extensions.
	for (const match of content.matchAll(/\.agents\/skills\/[A-Za-z0-9._/-]+/g)) {
		const referencedPath = match[0].replace(/[,:;.]+$/u, "");
		const destination = path.resolve(referencedPath);
		try {
			await lstat(destination);
		} catch (error) {
			if (hasErrorCode(error, "ENOENT")) throw new Error(`Referenced Skill path does not exist: ${referencedPath} in ${filePath}`);
			throw error;
		}
	}
}

/** @param {string} root @param {string} [directory] */
async function collectFiles(root, directory = root) {
	const names = (await readdir(directory)).sort(compareText);
	const files = [];
	for (const name of names) {
		const absolute = path.join(directory, name);
		const stat = await lstat(absolute);
		if (stat.isSymbolicLink()) throw new Error(`Symlink is not allowed in canonical Skills: ${absolute}`);
		if (stat.isDirectory()) files.push(...(await collectFiles(root, absolute)));
		else if (stat.isFile()) files.push(absolute);
		else throw new Error(`Unsupported canonical Skill entry: ${absolute}`);
	}
	return files;
}

/** @param {string} canonicalRoot */
async function validateAndCollectCanonical(canonicalRoot) {
	const rootStat = await lstat(canonicalRoot);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Canonical Skill root is invalid: ${canonicalRoot}`);
	const directoryNames = (await readdir(canonicalRoot)).filter((name) => !name.startsWith(".")).sort(compareText);
	const fileEntries = [];
	for (const skillName of directoryNames) {
		const skillRoot = path.join(canonicalRoot, skillName);
		const stat = await lstat(skillRoot);
		if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
		const skillFile = path.join(skillRoot, "SKILL.md");
		const metadataFile = path.join(skillRoot, "agents", "openai.yaml");
		const skillContent = await readText(skillFile);
		validateSkillFrontmatter(skillContent, skillName, skillFile);
		validateOpenAiMetadata(await readText(metadataFile), skillName, metadataFile);
		const files = await collectFiles(skillRoot);
		for (const filePath of files) {
			const relative = path.relative(canonicalRoot, filePath).split(path.sep).join("/");
			const content = await readFile(filePath);
			if (filePath.endsWith(".md")) await validateMarkdownLinks(skillRoot, filePath, content.toString("utf8"));
			fileEntries.push({ path: relative, bytes: content.byteLength, sha256: sha256(content), source: filePath });
		}
	}
	if (fileEntries.length === 0) throw new Error(`No canonical Skills found: ${canonicalRoot}`);
	fileEntries.sort((left, right) => compareText(left.path, right.path));
	return fileEntries;
}

/** @param {string} manifestPath */
async function readMirrorManifest(manifestPath) {
	try {
		const stat = await lstat(manifestPath);
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Mirror manifest is not a regular file: ${manifestPath}`);
		const parsed = JSON.parse(await readText(manifestPath));
		if (!parsed || parsed.format !== 1 || parsed.source !== CANONICAL_ROOT || !Array.isArray(parsed.files)) {
			throw new Error(`Mirror manifest has an invalid format: ${manifestPath}`);
		}
		const seen = new Set();
		const seenFolded = new Set();
		for (const entry of parsed.files) {
			if (
				!entry ||
				typeof entry.path !== "string" ||
				!Number.isSafeInteger(entry.bytes) ||
				entry.bytes < 0 ||
				typeof entry.sha256 !== "string" ||
				!/^[a-f0-9]{64}$/u.test(entry.sha256)
			) {
				throw new Error(`Mirror manifest has an invalid file entry: ${manifestPath}`);
			}
			validateManagedRelativePath(entry.path);
			const folded = entry.path.toLocaleLowerCase("en-US");
			if (seen.has(entry.path) || seenFolded.has(folded)) {
				throw new Error(`Mirror manifest contains a duplicate or case-colliding path: ${entry.path}`);
			}
			seen.add(entry.path);
			seenFolded.add(folded);
		}
		return parsed;
	} catch (error) {
		if (hasErrorCode(error, "ENOENT")) return undefined;
		if (error instanceof SyntaxError) throw new Error(`Mirror manifest contains invalid JSON: ${manifestPath}`);
		throw error;
	}
}

/** @param {string} value */
function validateManagedRelativePath(value) {
	if (
		value.length === 0 ||
		value === "." ||
		value.includes("\\") ||
		value.includes("\0") ||
		value.startsWith("/") ||
		/^[A-Za-z]:/u.test(value)
	) {
		throw new Error(`Invalid managed mirror path: ${JSON.stringify(value)}.`);
	}
	const segments = value.split("/");
	if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
		throw new Error(`Managed mirror path must be canonical and may not traverse: ${JSON.stringify(value)}.`);
	}
	if (path.posix.normalize(value) !== value) {
		throw new Error(`Managed mirror path must be canonical: ${JSON.stringify(value)}.`);
	}
}

/** @param {string} root @param {string} target */
async function assertNoTargetSymlinks(root, target) {
	let current = root;
	const relative = path.relative(root, target);
	for (const segment of relative.split(path.sep).filter(Boolean)) {
		current = path.join(current, segment);
		try {
			const stat = await lstat(current);
			if (stat.isSymbolicLink()) throw new Error(`Claude mirror path must not contain symlinks: ${current}`);
		} catch (error) {
			if (!hasErrorCode(error, "ENOENT")) throw error;
		}
	}
}

/** @param {string} targetRoot @param {string} relativePath */
async function removeManagedFile(targetRoot, relativePath) {
	const target = path.join(targetRoot, ...relativePath.split("/"));
	if (!isInside(targetRoot, target)) throw new Error(`Managed mirror path escapes target root: ${relativePath}`);
	try {
		const stat = await lstat(target);
		if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Managed mirror path is not a regular file: ${target}`);
		await rm(target);
	} catch (error) {
		if (hasErrorCode(error, "ENOENT")) return;
		throw error;
	}
	let parent = path.dirname(target);
	while (parent !== targetRoot && isInside(targetRoot, parent)) {
		try {
			await rmdir(parent);
		} catch (error) {
			if (hasErrorCode(error, "ENOTEMPTY") || hasErrorCode(error, "ENOENT")) break;
			throw error;
		}
		parent = path.dirname(parent);
	}
}

/** @param {string} targetRoot @param {string} manifestPath @param {Awaited<ReturnType<typeof validateAndCollectCanonical>>} canonical */
async function syncMirror(targetRoot, manifestPath, canonical) {
	await mkdir(targetRoot, { recursive: true });
	const previous = await readMirrorManifest(manifestPath);
	const currentPaths = new Set(canonical.map((entry) => entry.path));
	for (const entry of previous?.files ?? []) {
		if (!currentPaths.has(entry.path)) await removeManagedFile(targetRoot, entry.path);
	}
	for (const entry of canonical) {
		const target = path.join(targetRoot, ...entry.path.split("/"));
		await assertNoTargetSymlinks(targetRoot, path.dirname(target));
		await mkdir(path.dirname(target), { recursive: true });
		try {
			const stat = await lstat(target);
			if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Claude mirror target is not a regular file: ${target}`);
		} catch (error) {
			if (!hasErrorCode(error, "ENOENT")) throw error;
		}
		await copyFile(entry.source, target);
	}
	const manifest = {
		format: 1,
		source: CANONICAL_ROOT,
		files: canonical.map(({ path: filePath, bytes, sha256: digest }) => ({ path: filePath, bytes, sha256: digest })),
	};
	// This is the one managed metadata file. Explicit --sync authorizes replacing
	// it; direct write also works on Windows, where rename cannot replace a file.
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "w" });
}

/** @param {string} targetRoot @param {string} manifestPath @param {Awaited<ReturnType<typeof validateAndCollectCanonical>>} canonical */
async function checkMirror(targetRoot, manifestPath, canonical) {
	const mirror = await readMirrorManifest(manifestPath);
	if (!mirror) throw new Error(`Claude Skill mirror is missing. Run with --sync: ${targetRoot}`);
	const expectedByPath = new Map(canonical.map((entry) => [entry.path, entry]));
	const recordedByPath = new Map();
	for (const entry of mirror.files) {
		if (recordedByPath.has(entry.path)) throw new Error(`Duplicate path in mirror manifest: ${entry.path}`);
		recordedByPath.set(entry.path, entry);
	}
	const drift = [];
	for (const [relativePath, expected] of expectedByPath) {
		const recorded = recordedByPath.get(relativePath);
		if (!recorded || recorded.bytes !== expected.bytes || recorded.sha256 !== expected.sha256) {
			drift.push(`manifest drift: ${relativePath}`);
			continue;
		}
		const target = path.join(targetRoot, ...relativePath.split("/"));
		try {
			const stat = await lstat(target);
			if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a regular file");
			const content = await readFile(target);
			if (content.byteLength !== expected.bytes || sha256(content) !== expected.sha256) drift.push(`content drift: ${relativePath}`);
		} catch (error) {
			if (hasErrorCode(error, "ENOENT")) drift.push(`missing: ${relativePath}`);
			else if (error instanceof Error && error.message === "not a regular file") drift.push(`invalid target: ${relativePath}`);
			else throw error;
		}
	}
	for (const relativePath of recordedByPath.keys()) {
		if (!expectedByPath.has(relativePath)) drift.push(`stale managed file: ${relativePath}`);
	}
	if (drift.length > 0) throw new Error(`Claude Skill mirror drift detected:\n${drift.sort(compareText).join("\n")}`);
}

export async function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(usage);
		return;
	}
	if (argv.length > 1 || (argv.length === 1 && !["--check", "--sync"].includes(argv[0]))) {
		throw new Error(`Expected no argument, --check, or --sync.\n${usage}`);
	}
	const mode = argv[0] === "--sync" ? "sync" : "check";
	const repository = await realpath(process.cwd());
	const canonicalRoot = path.join(repository, CANONICAL_ROOT);
	const targetRoot = path.join(repository, CLAUDE_ROOT);
	const manifestPath = path.join(targetRoot, MIRROR_MANIFEST);
	const canonical = await validateAndCollectCanonical(canonicalRoot);
	if (mode === "sync") await syncMirror(targetRoot, manifestPath, canonical);
	await checkMirror(targetRoot, manifestPath, canonical);
	console.log(`${mode === "sync" ? "Synchronized and verified" : "Verified"} ${canonical.length} managed Claude Skill file(s).`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
