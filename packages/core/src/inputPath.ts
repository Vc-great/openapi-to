import path from "node:path";

export type InputPathKind =
	| "relative-path"
	| "posix-absolute-path"
	| "windows-absolute-path"
	| "windows-drive-relative-path"
	| "unc-path"
	| "http-url"
	| "https-url"
	| "file-url"
	| "other-url";

const WINDOWS_DRIVE_RELATIVE = /^[a-zA-Z]:(?![\\/])/;
const UNC_PATH = /^(?:\\\\|\/\/)[^\\/]+[\\/]/;
const URL_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/** Classify configured input strings without treating a Windows drive as a URL scheme. */
export function classifyInputPath(value: string): InputPathKind {
	if (UNC_PATH.test(value)) return "unc-path";
	if (WINDOWS_DRIVE_RELATIVE.test(value)) return "windows-drive-relative-path";
	if (path.posix.isAbsolute(value)) return "posix-absolute-path";
	if (path.win32.isAbsolute(value)) return "windows-absolute-path";
	if (!URL_SCHEME.test(value)) return "relative-path";
	try {
		const url = new URL(value);
		if (url.protocol === "http:") return "http-url";
		if (url.protocol === "https:") return "https-url";
		if (url.protocol === "file:") return "file-url";
		return "other-url";
	} catch {
		return "other-url";
	}
}
