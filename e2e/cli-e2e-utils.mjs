import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
	access,
	mkdir,
	readdir,
	readFile,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sanitizeText } from "../scripts/ci-diagnostics/sanitize.mjs";

const maxJsonStdoutCharacters = 1024 * 1024;
const maxLogTailCharacters = 128 * 1024;

export const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

export function assert(condition, message) {
	if (!condition) throw new Error(message);
}

export async function exists(candidate) {
	try {
		await access(candidate);
		return true;
	} catch {
		return false;
	}
}

export async function writeJson(filePath, value) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function runAlias({
	alias,
	args,
	artifactDirectory,
	consumerRoot,
	cwd,
	label,
}) {
	const packageRoot = path.join(consumerRoot, "node_modules", "openapi-to");
	const manifest = JSON.parse(
		await readFile(path.join(packageRoot, "package.json"), "utf8"),
	);
	const relativeEntrypoint = manifest.bin?.[alias];
	assert(
		typeof relativeEntrypoint === "string",
		`The real consumer package does not publish the ${alias} alias.`,
	);
	const invocation = {
		command: process.execPath,
		args: [path.resolve(packageRoot, relativeEntrypoint), ...args],
	};
	return runLogged({
		...invocation,
		artifactDirectory,
		cwd,
		env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
		label,
	});
}

export async function runLogged({
	command,
	args,
	artifactDirectory,
	cwd,
	env = process.env,
	label,
}) {
	let stdout = "";
	let stdoutTail = "";
	let stderrTail = "";
	let stdoutTruncated = false;
	let stderrTruncated = false;
	const appendTail = (current, value) =>
		`${current}${value}`.slice(-maxLogTailCharacters);
	const result = await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			env,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});
		child.stdout.on("data", (chunk) => {
			const value = String(chunk);
			if (stdout.length < maxJsonStdoutCharacters) {
				const remaining = maxJsonStdoutCharacters - stdout.length;
				stdout += value.slice(0, remaining);
				if (value.length > remaining) stdoutTruncated = true;
			} else {
				stdoutTruncated = true;
			}
			stdoutTail = appendTail(stdoutTail, value);
			process.stdout.write(value);
		});
		child.stderr.on("data", (chunk) => {
			const value = String(chunk);
			if (stderrTail.length + value.length > maxLogTailCharacters) {
				stderrTruncated = true;
			}
			stderrTail = appendTail(stderrTail, value);
			process.stderr.write(value);
		});
		child.once("error", reject);
		child.once("close", (code, signal) => resolve({ code, signal }));
	});
	await Promise.all([
		writeFile(
			path.join(artifactDirectory, `${label}.stdout.log`),
			`${stdoutTruncated ? "[earlier output truncated]\n" : ""}${sanitizeText(stdoutTail)}`,
		),
		writeFile(
			path.join(artifactDirectory, `${label}.stderr.log`),
			`${stderrTruncated ? "[earlier output truncated]\n" : ""}${sanitizeText(stderrTail)}`,
		),
	]);
	return {
		...result,
		stdout,
		stderr: stderrTail,
		stdoutTruncated,
		stderrTruncated,
		command: path.basename(command),
		args,
	};
}

export function parseJsonStdout(result, label) {
	assert(
		result.code === 0,
		`${label} exited with ${result.code ?? result.signal ?? "unknown"}.`,
	);
	assert(
		result.stdoutTruncated !== true,
		`${label} stdout exceeded ${maxJsonStdoutCharacters} characters.`,
	);
	try {
		return JSON.parse(result.stdout);
	} catch (error) {
		throw new Error(
			`${label} stdout was not exactly one JSON document: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

export async function listFiles(root) {
	if (!(await exists(root))) return [];
	const files = [];
	async function visit(directory) {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(absolutePath);
			else if (entry.isFile()) {
				const details = await stat(absolutePath);
				files.push({
					path: path.relative(root, absolutePath).split(path.sep).join("/"),
					bytes: details.size,
				});
			}
		}
	}
	await visit(root);
	return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function outputHashes(root) {
	const result = {};
	for (const file of await listFiles(root)) {
		const bytes = await readFile(path.join(root, file.path));
		result[file.path] = createHash("sha256").update(bytes).digest("hex");
	}
	return result;
}

export function manifestPaths(manifest) {
	assert(
		manifest?.version === 2 && Array.isArray(manifest.files),
		"Ownership manifest must use version 2 with a files array.",
	);
	return manifest.files
		.map((entry) => (typeof entry === "string" ? entry : entry?.path))
		.filter((entry) => typeof entry === "string")
		.sort();
}

export function runtimeMetadata() {
	return {
		platform: process.platform,
		arch: process.arch,
		node: process.version,
		pnpmEntrypoint: process.env.npm_execpath
			? path.basename(process.env.npm_execpath)
			: null,
	};
}
