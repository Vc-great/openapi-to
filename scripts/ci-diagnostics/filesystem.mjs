import { constants } from "node:fs";
import {
	lstat,
	mkdir,
	open,
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

async function assertNoSymlinkSegments(candidate, roots) {
	const lexicalRoot = roots
		.filter((root) => within(root, candidate))
		.sort((left, right) => right.length - left.length)[0];
	if (!lexicalRoot) return;
	const relative = path.relative(lexicalRoot, candidate);
	let cursor = lexicalRoot;
	for (const segment of relative.split(path.sep).filter(Boolean)) {
		cursor = path.join(cursor, segment);
		try {
			const details = await lstat(cursor);
			if (details.isSymbolicLink()) {
				throw new Error("Authorized path must not traverse a symlink.");
			}
		} catch (error) {
			if (error?.code === "ENOENT") return;
			throw error;
		}
	}
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
	await assertNoSymlinkSegments(resolved, roots);
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

function rejected(message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.diagnosticFileStatus = "rejected";
	return error;
}

function tooLarge(maxBytes) {
	const error = new Error(
		`Diagnostic input exceeds its ${maxBytes} byte size limit.`,
	);
	error.diagnosticFileStatus = "too-large";
	return error;
}

function sameOpenedFile(before, after) {
	const comparableIdentity =
		Number(before.dev) !== 0 &&
		Number(before.ino) !== 0 &&
		Number(after.dev) !== 0 &&
		Number(after.ino) !== 0;
	return (
		(!comparableIdentity ||
			(before.dev === after.dev && before.ino === after.ino)) &&
		before.mode === after.mode &&
		before.size === after.size
	);
}

function sameStableFile(before, after) {
	return (
		sameOpenedFile(before, after) &&
		before.mtimeMs === after.mtimeMs &&
		before.ctimeMs === after.ctimeMs
	);
}

export async function readBoundedRegularFile(
	filePath,
	{ maxBytes, encoding = "utf8", rejectHardLinks = true, onAfterLstat } = {},
) {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
		throw new Error("A non-negative bounded read size is required.");
	}
	const before = await lstat(filePath);
	if (before.isSymbolicLink() || !before.isFile()) {
		throw rejected("Diagnostic input must be a regular file, not a symlink.");
	}
	if (rejectHardLinks && Number(before.nlink) > 1) {
		throw rejected("Diagnostic input must not be a hard-linked file.");
	}
	if (before.size > maxBytes) throw tooLarge(maxBytes);
	await onAfterLstat?.(before);

	const noFollow =
		process.platform !== "win32" && typeof constants.O_NOFOLLOW === "number"
			? constants.O_NOFOLLOW
			: 0;
	let handle;
	try {
		handle = await open(filePath, constants.O_RDONLY | noFollow);
		const opened = await handle.stat();
		if (
			!opened.isFile() ||
			!sameOpenedFile(before, opened) ||
			(rejectHardLinks && Number(opened.nlink) > 1)
		) {
			throw rejected("Diagnostic input changed before it could be opened.");
		}
		if (opened.size > maxBytes) throw tooLarge(maxBytes);

		const buffer = Buffer.allocUnsafe(maxBytes + 1);
		let offset = 0;
		while (offset <= maxBytes) {
			const { bytesRead } = await handle.read(
				buffer,
				offset,
				maxBytes + 1 - offset,
				offset,
			);
			if (bytesRead === 0) break;
			offset += bytesRead;
			if (offset > maxBytes) throw tooLarge(maxBytes);
		}
		const after = await handle.stat();
		if (!sameStableFile(opened, after)) {
			throw rejected("Diagnostic input changed while it was being read.");
		}
		const bytes = buffer.subarray(0, offset);
		let contents = bytes;
		if (encoding === "utf8") {
			try {
				contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			} catch {
				throw rejected("Diagnostic input is not valid UTF-8.");
			}
		} else if (encoding !== null) {
			throw new Error(`Unsupported bounded read encoding: ${encoding}`);
		}
		return { contents, bytes: offset, details: after };
	} catch (error) {
		if (
			error?.diagnosticFileStatus ||
			error?.code === "ENOENT" ||
			error?.code === "EACCES" ||
			error?.code === "EPERM"
		) {
			throw error;
		}
		if (error?.code === "ELOOP") {
			throw rejected("Diagnostic input must not be a symlink.", error);
		}
		throw rejected("Diagnostic input could not be read safely.", error);
	} finally {
		await handle?.close().catch(() => {});
	}
}

export async function readBoundedJsonFile(filePath, options) {
	const result = await readBoundedRegularFile(filePath, options);
	try {
		return { ...result, value: JSON.parse(result.contents) };
	} catch {
		const error = new Error("Diagnostic JSON input is invalid.");
		error.diagnosticFileStatus = "invalid";
		throw error;
	}
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
