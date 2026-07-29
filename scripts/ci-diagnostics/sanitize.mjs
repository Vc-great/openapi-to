import path from "node:path";

import { MAX_LINE_CHARS } from "./schema.mjs";

const ansiPattern =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI CSI sequences contain ESC.
	/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const secretFlagPattern =
	/^(?:--?(?:access[-_]?token|api[-_]?key|authorization|auth[-_]?token|cookie|password|secret|token)|\/\/[^:]+\/:_authToken)$/i;
const secretAssignmentPattern =
	/^((?:--?)?(?:access[-_]?token|api[-_]?key|authorization|auth[-_]?token|cookie|password|secret|token)|\/\/[^:]+\/:_authToken)=(.*)$/i;

function replaceKnownPath(value, candidate, replacement) {
	if (!candidate) return value;
	const variants = new Set([
		path.resolve(candidate),
		path.resolve(candidate).replaceAll("\\", "/"),
		path.resolve(candidate).replaceAll("/", "\\"),
	]);
	let result = value;
	for (const variant of [...variants].sort(
		(left, right) => right.length - left.length,
	)) {
		if (variant.length > 1) result = result.split(variant).join(replacement);
	}
	return result;
}

function sanitizeUrl(match) {
	try {
		const url = new URL(match);
		if (url.username || url.password) {
			url.username = "[REDACTED]";
			url.password = "";
		}
		if (url.search) url.search = "?[REDACTED]";
		return url.toString();
	} catch {
		return match
			.replace(/\/\/[^/@\s]+@/, "//[REDACTED]@")
			.replace(/\?[^#\s]*/, "?[REDACTED]");
	}
}

export function sanitizeText(value, environment = process.env) {
	let result = String(value ?? "").replace(ansiPattern, "");
	result = result.replace(
		// Preserve line boundaries and tabs for bounded logs; remove other C0/C1 controls.
		// biome-ignore lint/suspicious/noControlCharactersInRegex: this is the control-character boundary.
		/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
		"",
	);
	result = replaceKnownPath(
		result,
		environment.GITHUB_WORKSPACE,
		"<workspace>",
	);
	result = replaceKnownPath(result, environment.RUNNER_TEMP, "<runner-temp>");
	result = replaceKnownPath(
		result,
		environment.HOME ?? environment.USERPROFILE,
		"<home>",
	);
	result = result.replace(
		/\b(Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]*/gi,
		"$1: [REDACTED]",
	);
	result = result.replace(
		/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
		"Bearer [REDACTED]",
	);
	result = result.replace(
		/\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g,
		"[REDACTED_GITHUB_TOKEN]",
	);
	result = result.replace(
		/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
		"[REDACTED_GITHUB_TOKEN]",
	);
	result = result.replace(/\bnpm_[A-Za-z0-9]{20,}\b/g, "[REDACTED_NPM_TOKEN]");
	result = result.replace(
		/(\/\/[^/\s]+\/:_authToken\s*=\s*)[^\s]+/gi,
		"$1[REDACTED]",
	);
	result = result.replace(
		/\b(token|secret|api[_-]?key|password)\s*[:=]\s*[^\s,;]+/gi,
		"$1=[REDACTED]",
	);
	result = result.replace(/https?:\/\/[^\s<>"']+/gi, sanitizeUrl);
	return result;
}

export function sanitizeLine(value, environment = process.env) {
	const sanitized = sanitizeText(value, environment);
	if (sanitized.length <= MAX_LINE_CHARS) {
		return { value: sanitized, truncated: false };
	}
	return {
		value: `${sanitized.slice(0, MAX_LINE_CHARS)}…[line truncated]`,
		truncated: true,
	};
}

export function sanitizeCommand(command, environment = process.env) {
	const result = [];
	let redactNext = false;
	for (const raw of command) {
		const value = String(raw);
		if (redactNext) {
			result.push("[REDACTED]");
			redactNext = false;
			continue;
		}
		const assignment = value.match(secretAssignmentPattern);
		if (assignment) {
			result.push(`${assignment[1]}=[REDACTED]`);
			continue;
		}
		const sanitized = sanitizeText(value, environment);
		result.push(sanitized);
		redactNext = secretFlagPattern.test(value);
	}
	return result;
}

export function markdownCell(value) {
	return sanitizeText(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\\", "\\\\")
		.replaceAll("|", "\\|")
		.replaceAll("`", "&#96;")
		.replaceAll("[", "\\[")
		.replaceAll("]", "\\]")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)")
		.replace(/\r?\n/g, " ")
		.slice(0, 1_000);
}

export function normalizeCwd(cwd, repositoryRoot, environment = process.env) {
	const resolved = path.resolve(cwd);
	const relative = path.relative(repositoryRoot, resolved);
	if (relative === "") return ".";
	if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
		return relative.split(path.sep).join("/");
	}
	const sanitized = sanitizeText(resolved, environment);
	return sanitized === resolved ? "<outside-workspace>" : sanitized;
}
