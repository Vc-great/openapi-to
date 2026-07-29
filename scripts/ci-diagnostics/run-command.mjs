#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
	atomicWrite,
	ensureSafeDirectory,
	readJsonFile,
	repositoryRoot,
	safeChild,
} from "./filesystem.mjs";
import {
	normalizeCwd,
	sanitizeCommand,
	sanitizeLine,
	sanitizeText,
} from "./sanitize.mjs";
import {
	assertCommandId,
	jsonBytes,
	MAX_COMMAND_REPORT_BYTES,
	MAX_ERROR_CANDIDATES,
	MAX_TAIL_LINES,
	SCHEMA_VERSION,
} from "./schema.mjs";

const errorCandidatePattern =
	/\b(?:error|failed|err_[a-z0-9_]+|assertionerror|typeerror|enoent|eperm|timed?\s*out|timeout)\b/i;

export function parseRunArguments(argv) {
	const separator = argv.indexOf("--");
	if (separator < 0 || separator === argv.length - 1) {
		throw new Error("run-command requires -- followed by a command.");
	}
	const options = {};
	for (let index = 0; index < separator; index += 1) {
		const argument = argv[index];
		if (
			["--dir", "--id", "--label", "--cwd", "--timeout-ms"].includes(argument)
		) {
			const value = argv[index + 1];
			if (!value || value === "--")
				throw new Error(`${argument} requires a value.`);
			options[argument.slice(2).replace("-ms", "Ms")] = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown run-command argument: ${argument}`);
	}
	if (!options.dir || !options.id) {
		throw new Error("run-command requires --dir and --id.");
	}
	assertCommandId(options.id);
	const timeoutMs =
		options.timeoutMs === undefined
			? null
			: Number.parseInt(options.timeoutMs, 10);
	if (
		timeoutMs !== null &&
		(!Number.isSafeInteger(timeoutMs) ||
			timeoutMs < 1 ||
			timeoutMs > 60 * 60 * 1_000)
	) {
		throw new Error("--timeout-ms must be between 1 and 3600000.");
	}
	return {
		...options,
		timeoutMs,
		command: argv.slice(separator + 1),
	};
}

export function resolveInvocation(
	command,
	args,
	{
		platform = process.platform,
		npmExecPath = process.env.npm_execpath,
		execPath = process.execPath,
	} = {},
) {
	if (command !== "pnpm") return { command, args };
	if (npmExecPath && /\.(?:c|m)?js$/i.test(npmExecPath)) {
		return { command: execPath, args: [npmExecPath, ...args] };
	}
	return { command: platform === "win32" ? "pnpm.cmd" : "pnpm", args };
}

class BoundedOutput {
	constructor(stream, environment) {
		this.stream = stream;
		this.environment = environment;
		this.partial = "";
		this.discardingLongLine = false;
		this.lines = [];
		this.totalLines = 0;
		this.truncatedLines = 0;
		this.candidates = [];
	}

	push(chunk) {
		let value = String(chunk);
		if (this.discardingLongLine) {
			const newline = value.indexOf("\n");
			if (newline < 0) return;
			this.discardingLongLine = false;
			value = value.slice(newline + 1);
		}
		this.partial += value;
		while (true) {
			const newline = this.partial.indexOf("\n");
			if (newline < 0) {
				if (this.partial.length > 4_096) {
					this.emit(this.partial.slice(0, 4_096), true);
					this.partial = "";
					this.discardingLongLine = true;
				}
				return;
			}
			const line = this.partial.slice(0, newline).replace(/\r$/, "");
			this.partial = this.partial.slice(newline + 1);
			this.emit(line, true);
		}
	}

	emit(line, newline) {
		const sanitized = sanitizeLine(line, this.environment);
		this.totalLines += 1;
		if (sanitized.truncated) this.truncatedLines += 1;
		this.lines.push(sanitized.value);
		if (this.lines.length > MAX_TAIL_LINES) this.lines.shift();
		if (
			errorCandidatePattern.test(sanitized.value) &&
			this.candidates.length < MAX_ERROR_CANDIDATES
		) {
			this.candidates.push({
				kind: "heuristic-candidate",
				text: sanitized.value,
			});
		}
		this.stream.write(`${sanitized.value}${newline ? "\n" : ""}`);
	}

	finish() {
		if (this.partial && !this.discardingLongLine)
			this.emit(this.partial, false);
		this.partial = "";
		this.discardingLongLine = false;
		return {
			tail: this.lines,
			totalLines: this.totalLines,
			truncated: this.totalLines > this.lines.length || this.truncatedLines > 0,
			truncatedLines: this.truncatedLines,
			candidates: this.candidates,
		};
	}
}

async function terminate(child, force = false) {
	if (!child.pid || child.exitCode !== null || child.signalCode !== null)
		return;
	if (process.platform === "win32") {
		spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
			shell: false,
			stdio: "ignore",
		});
		return;
	}
	try {
		process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
	} catch {
		child.kill(force ? "SIGKILL" : "SIGTERM");
	}
}

function exitFor(report) {
	if (report.status === "success") return 0;
	if (Number.isInteger(report.exitCode) && report.exitCode > 0) {
		return report.exitCode;
	}
	return 1;
}

export async function runCommand(
	options,
	environment = process.env,
	{ writeReport = atomicWrite } = {},
) {
	assertCommandId(options.id);
	const directory = await ensureSafeDirectory(options.dir, environment);
	const manifest = await readJsonFile(safeChild(directory, "plan.json"));
	const expected = manifest.commands?.find(({ id }) => id === options.id);
	if (!expected)
		throw new Error(
			`Command ${options.id} is not present in the initialized plan.`,
		);
	if (options.label && options.label !== expected.label) {
		throw new Error(
			`Command label for ${options.id} does not match the initialized plan.`,
		);
	}
	const cwd = path.resolve(options.cwd ?? repositoryRoot);
	const displayCommand = sanitizeCommand(options.command, environment);
	const invocation = resolveInvocation(
		options.command[0],
		options.command.slice(1),
	);
	const stdout = new BoundedOutput(process.stdout, environment);
	const stderr = new BoundedOutput(process.stderr, environment);
	const started = performance.now();
	let timedOut = false;
	let spawnError = null;
	let timer;
	let forceTimer;
	const outcome = await new Promise((resolve) => {
		let settled = false;
		const child = spawn(invocation.command, invocation.args, {
			cwd,
			env: environment,
			detached: process.platform !== "win32",
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});
		child.stdout?.on("data", (chunk) => stdout.push(chunk));
		child.stderr?.on("data", (chunk) => stderr.push(chunk));
		child.once("error", (error) => {
			spawnError = error;
			if (!settled) {
				settled = true;
				resolve({ exitCode: null, signal: null });
			}
		});
		child.once("close", (exitCode, signal) => {
			if (!settled) {
				settled = true;
				resolve({ exitCode, signal });
			}
		});
		if (options.timeoutMs !== null) {
			timer = setTimeout(() => {
				timedOut = true;
				terminate(child).catch(() => {});
				forceTimer = setTimeout(() => {
					terminate(child, true).catch(() => {});
				}, 1_000);
				forceTimer.unref();
			}, options.timeoutMs);
			timer.unref();
		}
	});
	clearTimeout(timer);
	clearTimeout(forceTimer);
	const stdoutEvidence = stdout.finish();
	const stderrEvidence = stderr.finish();
	const status = spawnError
		? "infrastructure-error"
		: timedOut
			? "timeout"
			: outcome.signal
				? "signalled"
				: outcome.exitCode === 0
					? "success"
					: "failure";
	const report = {
		schemaVersion: SCHEMA_VERSION,
		kind: "openapi-to-ci-command",
		id: options.id,
		label: expected.label,
		status,
		exitCode: outcome.exitCode,
		signal: outcome.signal,
		durationMs: Math.max(0, Math.round(performance.now() - started)),
		command: displayCommand,
		cwd: normalizeCwd(cwd, repositoryRoot, environment),
		evidence: {
			stdout: stdoutEvidence,
			stderr: stderrEvidence,
			spawnError: spawnError
				? sanitizeText(spawnError.message, environment).slice(0, 1_000)
				: null,
		},
	};
	if (jsonBytes(report) > MAX_COMMAND_REPORT_BYTES) {
		throw new Error(
			"Bounded command report unexpectedly exceeded its size limit.",
		);
	}
	try {
		await ensureSafeDirectory(directory, environment);
		await ensureSafeDirectory(safeChild(directory, "commands"), environment);
		await writeReport(
			safeChild(directory, "commands", `${options.id}.json`),
			`${JSON.stringify(report, null, 2)}\n`,
		);
	} catch (error) {
		error.commandExitCode = exitFor(report);
		throw error;
	}
	return { report, exitCode: exitFor(report) };
}

async function main() {
	let options;
	try {
		options = parseRunArguments(process.argv.slice(2));
		const result = await runCommand(options);
		process.exitCode = result.exitCode;
	} catch (error) {
		process.stderr.write(
			`[ci-diagnostics] command wrapper failed: ${sanitizeText(error instanceof Error ? error.message : String(error))}\n`,
		);
		process.exitCode =
			Number.isInteger(error?.commandExitCode) && error.commandExitCode > 0
				? error.commandExitCode
				: 1;
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await main();
}
