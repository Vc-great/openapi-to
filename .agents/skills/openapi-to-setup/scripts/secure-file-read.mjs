import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function isStatInteger(value) {
	return typeof value === "bigint" || (Number.isInteger(value) && Number.isSafeInteger(value));
}

function isNonZero(value) {
	return value !== 0 && value !== 0n;
}

function sameStatValues(left, right, fields) {
	return fields.every((field) => left[field] === right[field]);
}

function hasUsableIdentity(stats, platform) {
	if (!isStatInteger(stats?.dev) || !isStatInteger(stats?.ino) || !isNonZero(stats.ino)) return false;
	return platform === "win32" || isNonZero(stats.dev);
}

export function isInside(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function selectReadFlags({ readOnlyFlag, noFollowFlag }) {
	if (!Number.isInteger(readOnlyFlag)) throw new TypeError("readOnlyFlag must be an integer");
	return Number.isInteger(noFollowFlag) ? readOnlyFlag | noFollowFlag : readOnlyFlag;
}

export function sameOpenedFile(before, opened, platform = process.platform) {
	if (!before?.isFile?.() || !opened?.isFile?.()) return false;
	if (!hasUsableIdentity(before, platform) || !hasUsableIdentity(opened, platform)) return false;
	if (before.dev !== opened.dev || before.ino !== opened.ino) return false;
	if (platform !== "win32") return true;
	return sameStatValues(before, opened, [
		"size",
		"birthtimeNs",
		"ctimeNs",
		"mtimeNs",
		"mode",
	]);
}

export function unchangedDuringRead(before, after, platform = process.platform) {
	return (
		sameOpenedFile(before, after, platform) &&
		sameStatValues(before, after, [
			"size",
			"birthtimeNs",
			"ctimeNs",
			"mtimeNs",
			"mode",
			"nlink",
		])
	);
}

export async function openVerifiedFile(root, info, options = {}) {
	const readOnlyFlag = Object.hasOwn(options, "readOnlyFlag")
		? options.readOnlyFlag
		: constants.O_RDONLY;
	const noFollowFlag = Object.hasOwn(options, "noFollowFlag")
		? options.noFollowFlag
		: constants.O_NOFOLLOW;
	const platform = options.platform ?? process.platform;
	const flags = selectReadFlags({ readOnlyFlag, noFollowFlag });
	let handle;
	try {
		handle = await open(info.path, flags);
		const opened = await handle.stat({ bigint: true });
		if (!sameOpenedFile(info.stats, opened, platform)) {
			await handle.close();
			return { unsafe: true };
		}
		const current = await lstat(info.path, { bigint: true });
		if (current.isSymbolicLink() || !sameOpenedFile(current, opened, platform)) {
			await handle.close();
			return { unsafe: true };
		}
		const resolved = await realpath(info.path);
		if (!isInside(root, resolved) || resolved !== info.realPath) {
			await handle.close();
			return { unsafe: true };
		}
		return { handle, opened };
	} catch (error) {
		await handle?.close();
		if (error?.code === "ELOOP") return { unsafe: true };
		return { readError: true };
	}
}
