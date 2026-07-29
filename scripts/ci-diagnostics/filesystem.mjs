import {
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

function within(root, candidate) {
	const relative = path.relative(root, candidate);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

async function existingRealpath(candidate) {
	try {
		return await realpath(candidate);
	} catch (error) {
		if (error?.code === "ENOENT") return null;
		throw error;
	}
}

async function allowedRoots(environment) {
	const roots = [
		repositoryRoot,
		environment.GITHUB_WORKSPACE,
		environment.RUNNER_TEMP,
		os.tmpdir(),
	].filter(Boolean);
	const resolved = [];
	for (const root of roots) {
		const lexical = path.resolve(root);
		if (!resolved.includes(lexical)) resolved.push(lexical);
		const real = await existingRealpath(path.resolve(root));
		if (real && !resolved.includes(real)) resolved.push(real);
	}
	return resolved;
}

export async function ensureSafeDirectory(
	candidate,
	environment = process.env,
) {
	if (!candidate) throw new Error("A diagnostic directory is required.");
	const resolved = path.resolve(candidate);
	const roots = await allowedRoots(environment);
	if (!roots.some((root) => within(root, resolved))) {
		throw new Error("Diagnostic directory is outside the authorized roots.");
	}
	let cursor = resolved;
	while (!(await existingRealpath(cursor))) {
		const parent = path.dirname(cursor);
		if (parent === cursor)
			throw new Error("Diagnostic directory has no existing parent.");
		cursor = parent;
	}
	const existing = await realpath(cursor);
	if (!roots.some((root) => within(root, existing))) {
		throw new Error(
			"Diagnostic directory resolves outside the authorized roots.",
		);
	}
	await mkdir(resolved, { recursive: true });
	const details = await lstat(resolved);
	if (details.isSymbolicLink() || !details.isDirectory()) {
		throw new Error(
			"Diagnostic directory must be a real directory, not a symlink.",
		);
	}
	const finalPath = await realpath(resolved);
	if (!roots.some((root) => within(root, finalPath))) {
		throw new Error(
			"Diagnostic directory resolves outside the authorized roots.",
		);
	}
	return finalPath;
}

export function safeChild(root, ...segments) {
	const candidate = path.resolve(root, ...segments);
	if (!within(root, candidate))
		throw new Error("Diagnostic output path escapes its directory.");
	return candidate;
}

export async function assertRegularFile(candidate) {
	const details = await lstat(candidate);
	if (details.isSymbolicLink() || !details.isFile()) {
		throw new Error("Diagnostic input must be a regular file, not a symlink.");
	}
	return details;
}

export async function atomicWrite(filePath, contents) {
	const temporary = `${filePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
	try {
		await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
		await rename(temporary, filePath);
	} finally {
		await rm(temporary, { force: true }).catch(() => {});
	}
}

export async function readJsonFile(filePath) {
	return JSON.parse(await readFile(filePath, "utf8"));
}
