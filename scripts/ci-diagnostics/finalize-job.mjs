#!/usr/bin/env node

import { appendFile, lstat, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	assertRegularFile,
	atomicWrite,
	ensureSafeDirectory,
	readJsonFile,
	repositoryRoot,
	safeChild,
} from "./filesystem.mjs";
import { getPlan } from "./plans.mjs";
import { markdownCell, sanitizeCommand, sanitizeText } from "./sanitize.mjs";
import {
	COMMAND_STATUSES,
	DIAGNOSTIC_KIND,
	jsonBytes,
	MAX_COMMAND_REPORT_BYTES,
	MAX_DIAGNOSTIC_BYTES,
	MAX_ERROR_CANDIDATES,
	MAX_KNOWN_REPORT_BYTES,
	MAX_SUMMARY_CHARS,
	SCHEMA_VERSION,
	stableObject,
} from "./schema.mjs";

const commandFailureStatuses = new Set([
	"failure",
	"timeout",
	"signalled",
	"cancelled",
	"infrastructure-error",
]);

export function parseFinalizeArguments(argv) {
	const result = { matrix: {} };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (["--dir", "--plan", "--job-status"].includes(argument)) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`${argument} requires a value.`);
			}
			result[argument.slice(2).replace("-status", "Status")] = value;
			index += 1;
			continue;
		}
		if (argument === "--matrix") {
			const value = argv[index + 1];
			const separator = value?.indexOf("=") ?? -1;
			if (separator < 1) throw new Error("--matrix requires key=value.");
			const key = value.slice(0, separator);
			if (!/^[a-z][a-z0-9-]*$/.test(key)) {
				throw new Error("Matrix keys must be stable lowercase identifiers.");
			}
			result.matrix[key] = value.slice(separator + 1);
			index += 1;
			continue;
		}
		throw new Error(`Unknown finalize argument: ${argument}`);
	}
	if (!result.dir || !result.plan) {
		throw new Error("finalize-job requires --dir and --plan.");
	}
	return result;
}

function nullable(value, environment) {
	if (typeof value !== "string" || value.length === 0) return null;
	return sanitizeText(value, environment).slice(0, 500);
}

function sha(value) {
	return /^[0-9a-f]{7,40}$/i.test(value ?? "") ? value : null;
}

function workflowMetadata(plan, environment) {
	return {
		name: plan.workflow,
		eventName: nullable(environment.GITHUB_EVENT_NAME, environment),
		runId: nullable(environment.GITHUB_RUN_ID, environment),
		runAttempt: nullable(environment.GITHUB_RUN_ATTEMPT, environment),
		jobId: plan.jobId,
		jobName: plan.jobName,
		repository: nullable(environment.GITHUB_REPOSITORY, environment),
		ref: nullable(environment.GITHUB_REF, environment),
		commitSha: sha(environment.GITHUB_SHA),
		baseSha: sha(environment.CI_BASE_SHA),
		headSha: sha(environment.CI_HEAD_SHA),
	};
}

async function runnerMetadata(environment) {
	let pnpmVersion = null;
	try {
		const manifest = JSON.parse(
			await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
		);
		pnpmVersion =
			typeof manifest.packageManager === "string"
				? manifest.packageManager.replace(/^pnpm@/, "")
				: null;
	} catch {
		pnpmVersion = null;
	}
	return {
		os: nullable(environment.RUNNER_OS, environment) ?? process.platform,
		architecture:
			nullable(environment.RUNNER_ARCH, environment) ?? process.arch,
		nodeVersion: process.versions.node,
		pnpmVersion,
	};
}

function boundedCandidate(value, source, environment) {
	if (value === undefined || value === null || value === "") return null;
	return {
		source,
		kind: "structured-report",
		text: sanitizeText(String(value), environment).slice(0, 1_000),
	};
}

function summarizeJson(id, value, environment) {
	const summary = {};
	const candidates = [];
	if (id === "a1-summary") {
		Object.assign(summary, {
			exitCode: value?.exitCode ?? null,
			signal: value?.signal ?? null,
			expectedFiles: value?.expectedFiles ?? null,
			actualFiles: value?.actualFiles ?? null,
			expectedTests: value?.expectedTests ?? null,
			actualTests: value?.actualTests ?? null,
			inventoryMatches: value?.inventoryMatches ?? null,
			failedTests: Array.isArray(value?.failedTests)
				? Math.min(value.failedTests.length, MAX_ERROR_CANDIDATES)
				: 0,
		});
		for (const failure of value?.failedTests?.slice(0, MAX_ERROR_CANDIDATES) ??
			[]) {
			const candidate = boundedCandidate(
				`${failure?.title ?? "test failure"}: ${failure?.failure ?? ""}`,
				"a1-summary",
				environment,
			);
			if (candidate) candidates.push(candidate);
		}
	} else if (id === "a1-vitest" || id === "mcp-results") {
		Object.assign(summary, {
			success: value?.success ?? null,
			totalTests: value?.numTotalTests ?? null,
			passedTests: value?.numPassedTests ?? null,
			failedTests: value?.numFailedTests ?? null,
			testFiles: Array.isArray(value?.testResults)
				? value.testResults.length
				: null,
		});
		for (const file of value?.testResults ?? []) {
			for (const assertion of file?.assertionResults ?? []) {
				if (
					assertion?.status === "failed" &&
					candidates.length < MAX_ERROR_CANDIDATES
				) {
					const candidate = boundedCandidate(
						`${assertion.fullName ?? assertion.title ?? "test failure"}: ${
							assertion.failureMessages?.[0] ?? ""
						}`,
						id,
						environment,
					);
					if (candidate) candidates.push(candidate);
				}
			}
		}
	} else if (id === "mcp-runner") {
		Object.assign(summary, {
			group: nullable(value?.group, environment),
			files: Array.isArray(value?.files) ? value.files.length : null,
			expectedTests: value?.expectedTests ?? null,
			scripts: Array.isArray(value?.scripts) ? value.scripts.length : null,
		});
	} else if (id === "mcp-doctor") {
		Object.assign(summary, {
			success: value?.success ?? null,
			status: nullable(value?.status, environment),
			passed: value?.summary?.passed ?? null,
			failed: value?.summary?.failed ?? null,
			skipped: value?.summary?.skipped ?? null,
			total: value?.summary?.total ?? null,
			failureCodes: Array.isArray(value?.failureCodes)
				? value.failureCodes.slice(0, MAX_ERROR_CANDIDATES)
				: [],
		});
		for (const check of value?.checks ?? []) {
			if (
				check?.status === "failed" &&
				candidates.length < MAX_ERROR_CANDIDATES
			) {
				const candidate = boundedCandidate(
					`${check.id ?? "doctor-check"}: ${check.detail ?? check.failureCode ?? "failed"}`,
					"mcp-doctor",
					environment,
				);
				if (candidate) candidates.push(candidate);
			}
		}
	} else if (id === "cli-summary" || id === "mcp-smoke") {
		Object.assign(summary, {
			status: nullable(value?.status, environment),
			stage: nullable(value?.stage, environment),
		});
		const candidate = boundedCandidate(value?.error, id, environment);
		if (candidate) candidates.push(candidate);
	} else if (id === "a1-runtime" || id === "cli-runtime") {
		Object.assign(summary, {
			platform: nullable(value?.platform, environment),
			architecture: nullable(value?.arch, environment),
			node: nullable(value?.node, environment),
			pnpm: nullable(value?.pnpm, environment),
		});
	} else {
		Object.assign(summary, {
			parsedType: Array.isArray(value) ? "array" : typeof value,
		});
	}
	return { summary, candidates };
}

async function reportSource(definition, environment) {
	const configured = environment[definition.sourceEnv];
	if (!configured) return null;
	return definition.relativePath === "."
		? path.resolve(configured)
		: path.resolve(configured, definition.relativePath);
}

async function collectReport(definition, diagnosticDirectory, environment) {
	const source = await reportSource(definition, environment);
	const base = {
		id: definition.id,
		label: definition.label,
		path: source
			? sanitizeText(source, environment)
			: `${definition.sourceEnv}/${definition.relativePath}`,
		exists: false,
		bytes: null,
		parseStatus: "missing",
		artifactPath: null,
		summary: {},
		candidates: [],
	};
	if (!source) return base;
	let details;
	try {
		await ensureSafeDirectory(path.dirname(source), environment);
		details = await assertRegularFile(source);
	} catch (error) {
		if (error?.code === "ENOENT") return base;
		return {
			...base,
			parseStatus: "rejected",
			error: sanitizeText(error.message, environment).slice(0, 500),
		};
	}
	base.exists = true;
	base.bytes = details.size;
	if (details.size > MAX_KNOWN_REPORT_BYTES) {
		base.parseStatus = "too-large";
		return base;
	}
	try {
		const contents = await readFile(source, "utf8");
		let normalized;
		if (definition.format === "text") {
			const lines = contents.split(/\r?\n/).filter(Boolean);
			normalized = {
				lines: lines.length,
				truncated: lines.length > 1_000,
			};
		} else {
			const parsed = JSON.parse(contents);
			normalized = summarizeJson(definition.id, parsed, environment);
			base.candidates = normalized.candidates;
			normalized = normalized.summary;
		}
		base.parseStatus = "parsed";
		base.summary = normalized;
		base.artifactPath = `known-reports/${definition.id}.json`;
		await atomicWrite(
			safeChild(diagnosticDirectory, base.artifactPath),
			`${JSON.stringify(
				{
					schemaVersion: SCHEMA_VERSION,
					kind: "openapi-to-ci-known-report-summary",
					id: definition.id,
					sourceBytes: details.size,
					summary: normalized,
					candidates: base.candidates,
				},
				null,
				2,
			)}\n`,
		);
		return base;
	} catch (error) {
		base.parseStatus = "invalid";
		base.error = sanitizeText(error.message, environment).slice(0, 500);
		return base;
	}
}

function notRun(expected) {
	return {
		id: expected.id,
		label: expected.label,
		status: "not-run",
		exitCode: null,
		signal: null,
		durationMs: null,
		command: null,
		cwd: null,
		evidence: {
			stdout: { totalLines: 0, truncated: false, truncatedLines: 0 },
			stderr: { totalLines: 0, truncated: false, truncatedLines: 0 },
			candidates: [],
		},
	};
}

function nonNegativeNumber(value) {
	return Number.isFinite(value) && value >= 0 ? value : null;
}

function nonNegativeInteger(value) {
	return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function collectCommands(plan, directory, environment) {
	const commands = [];
	const errors = [];
	await ensureSafeDirectory(safeChild(directory, "commands"), environment);
	for (const expected of plan.commands) {
		const filePath = safeChild(directory, "commands", `${expected.id}.json`);
		try {
			const details = await assertRegularFile(filePath);
			if (details.size > MAX_COMMAND_REPORT_BYTES) {
				throw new Error("Command report exceeds its size limit.");
			}
			const value = await readJsonFile(filePath);
			if (
				value?.schemaVersion !== SCHEMA_VERSION ||
				value?.kind !== "openapi-to-ci-command" ||
				value?.id !== expected.id ||
				value?.label !== expected.label
			) {
				throw new Error("Command report does not match its initialized plan.");
			}
			if (
				!COMMAND_STATUSES.includes(value.status) ||
				value.status === "not-run"
			) {
				throw new Error("Command report contains an invalid executed status.");
			}
			commands.push({
				id: value.id,
				label: value.label,
				status: value.status,
				exitCode:
					value.exitCode === null || Number.isSafeInteger(value.exitCode)
						? value.exitCode
						: null,
				signal: value.signal
					? sanitizeText(value.signal, environment).slice(0, 50)
					: null,
				durationMs: nonNegativeNumber(value.durationMs),
				command: Array.isArray(value.command)
					? sanitizeCommand(value.command, environment)
					: null,
				cwd: sanitizeText(value.cwd ?? "", environment).slice(0, 500),
				evidence: {
					stdout: {
						totalLines: nonNegativeInteger(value.evidence?.stdout?.totalLines),
						truncated: value.evidence?.stdout?.truncated === true,
						truncatedLines: nonNegativeInteger(
							value.evidence?.stdout?.truncatedLines,
						),
						lastLine: sanitizeText(
							value.evidence?.stdout?.tail?.at(-1) ?? "",
							environment,
						).slice(0, 1_000),
					},
					stderr: {
						totalLines: nonNegativeInteger(value.evidence?.stderr?.totalLines),
						truncated: value.evidence?.stderr?.truncated === true,
						truncatedLines: nonNegativeInteger(
							value.evidence?.stderr?.truncatedLines,
						),
						lastLine: sanitizeText(
							value.evidence?.stderr?.tail?.at(-1) ?? "",
							environment,
						).slice(0, 1_000),
					},
					candidates: [
						...(value.evidence?.stderr?.candidates ?? []).map((candidate) => ({
							...candidate,
							stream: "stderr",
						})),
						...(value.evidence?.stdout?.candidates ?? []).map((candidate) => ({
							...candidate,
							stream: "stdout",
						})),
					]
						.slice(0, MAX_ERROR_CANDIDATES)
						.map((candidate) => ({
							kind:
								candidate?.kind === "heuristic-candidate"
									? "heuristic-candidate"
									: "heuristic-candidate",
							stream: candidate.stream,
							text: sanitizeText(candidate?.text ?? "", environment).slice(
								0,
								1_000,
							),
						})),
					spawnError: value.evidence?.spawnError
						? sanitizeText(value.evidence.spawnError, environment).slice(
								0,
								1_000,
							)
						: null,
				},
			});
		} catch (error) {
			if (error?.code !== "ENOENT") {
				errors.push(
					`${expected.id}: ${sanitizeText(error.message, environment).slice(0, 500)}`,
				);
			}
			commands.push(notRun(expected));
		}
	}
	return { commands, errors };
}

function selectEvidence(commands, reports) {
	const structured = reports.flatMap(({ candidates }) => candidates ?? []);
	const commandCandidates = commands.flatMap((command) =>
		(command.evidence?.candidates ?? []).map((candidate) => ({
			source: `${command.id}/${candidate.stream ?? "output"}`,
			kind: candidate.kind ?? "heuristic-candidate",
			text: candidate.text,
		})),
	);
	const exitEvidence = commands
		.filter(({ status }) => commandFailureStatuses.has(status))
		.map((command) => ({
			source: command.id,
			kind: "command-exit",
			text: `${command.label} exited with ${
				command.exitCode ?? command.signal ?? command.status
			}.`,
		}));
	const fallbackTails = commands
		.filter(({ status }) => commandFailureStatuses.has(status))
		.flatMap((command) =>
			[
				["stderr-tail", command.evidence?.stderr?.lastLine],
				["stdout-tail", command.evidence?.stdout?.lastLine],
			]
				.filter(([, text]) => text)
				.map(([kind, text]) => ({
					source: command.id,
					kind,
					text,
				})),
		);
	return [
		...structured,
		...exitEvidence,
		...commandCandidates,
		...fallbackTails,
	].slice(0, MAX_ERROR_CANDIDATES);
}

function duration(value) {
	if (!Number.isFinite(value)) return "—";
	return `${(value / 1_000).toFixed(1)}s`;
}

export function renderSummary(diagnostic, artifactName) {
	const lines = [
		"## CI diagnostics",
		"",
		"| Field | Value |",
		"| --- | --- |",
		`| Status | ${markdownCell(diagnostic.status)} |`,
		`| Workflow | ${markdownCell(diagnostic.workflow.name)} |`,
		`| Job | ${markdownCell(diagnostic.workflow.jobName)} |`,
		`| Runner | ${markdownCell(`${diagnostic.runner.os} / ${diagnostic.runner.architecture}`)} |`,
		`| Commit | ${markdownCell(diagnostic.workflow.commitSha?.slice(0, 7) ?? "unavailable")} |`,
		`| Diagnostic schema | ${SCHEMA_VERSION} |`,
		"",
		"### Commands",
		"",
		"| Command | Status | Exit | Duration |",
		"| --- | --- | ---: | ---: |",
	];
	for (const command of diagnostic.commands) {
		lines.push(
			`| ${markdownCell(command.label)} | ${markdownCell(command.status)} | ${
				command.exitCode ?? "—"
			} | ${duration(command.durationMs)} |`,
		);
	}
	lines.push("", "### Failure evidence", "");
	if (diagnostic.summary.failureEvidence.length === 0) {
		lines.push("- No failure evidence was collected.");
	} else {
		for (const evidence of diagnostic.summary.failureEvidence.slice(0, 3)) {
			lines.push(
				`- Source: ${markdownCell(evidence.source)}; ${markdownCell(evidence.kind)}: \`${markdownCell(evidence.text)}\``,
			);
		}
	}
	lines.push(
		`- Output truncated: ${diagnostic.summary.outputTruncated ? "yes" : "no"}`,
		"",
		"### Artifact",
		"",
		`\`${markdownCell(artifactName)}\``,
		"",
	);
	const rendered = lines.join("\n");
	return rendered.length <= MAX_SUMMARY_CHARS
		? rendered
		: `${rendered.slice(0, MAX_SUMMARY_CHARS)}\n\n_Summary truncated._\n`;
}

export function artifactAllowlist(plan, reports) {
	return [
		"ci-diagnostic.json",
		"summary.md",
		"plan.json",
		...plan.commands.map(({ id }) => `commands/${id}.json`),
		...reports
			.filter(({ artifactPath }) => artifactPath)
			.map(({ artifactPath }) => artifactPath),
	].sort();
}

async function pruneArtifactDirectory(directory, allowlist) {
	const allowed = new Set(allowlist);
	async function visit(relativeDirectory = "") {
		const absoluteDirectory = relativeDirectory
			? safeChild(directory, relativeDirectory)
			: directory;
		for (const entry of await readdir(absoluteDirectory, {
			withFileTypes: true,
		})) {
			const relativePath = relativeDirectory
				? `${relativeDirectory}/${entry.name}`
				: entry.name;
			const requiredDirectory = [...allowed].some((candidate) =>
				candidate.startsWith(`${relativePath}/`),
			);
			if (entry.isDirectory() && requiredDirectory) {
				await visit(relativePath);
				continue;
			}
			if (entry.isFile() && allowed.has(relativePath)) continue;
			await rm(safeChild(directory, relativePath), {
				recursive: true,
				force: true,
			});
		}
	}
	await visit();
}

function overallStatus(jobStatus, commands, finalizationErrors) {
	if (jobStatus === "cancelled") return "cancelled";
	if (
		jobStatus === "failure" ||
		commands.some(({ status }) => commandFailureStatuses.has(status))
	) {
		return "failure";
	}
	if (
		finalizationErrors.length > 0 ||
		commands.some(({ status }) => status === "not-run")
	) {
		return "failure";
	}
	return "success";
}

export async function finalize(options, environment = process.env) {
	const directory = await ensureSafeDirectory(options.dir, environment);
	const manifest = await readJsonFile(safeChild(directory, "plan.json"));
	const plan = getPlan(options.plan);
	if (
		manifest.planId !== options.plan ||
		manifest.schemaVersion !== SCHEMA_VERSION
	) {
		throw new Error(
			"Initialized diagnostic plan does not match finalizer input.",
		);
	}
	await ensureSafeDirectory(safeChild(directory, "known-reports"), environment);
	const { commands, errors } = await collectCommands(
		plan,
		directory,
		environment,
	);
	const reports = [];
	for (const definition of plan.reports) {
		reports.push(await collectReport(definition, directory, environment));
	}
	const missingReports = reports
		.filter(({ parseStatus }) => parseStatus !== "parsed")
		.map(({ id, parseStatus }) => `${id}: ${parseStatus}`);
	const allCommandsSuccessful = commands.every(
		({ status }) => status === "success",
	);
	const finalizationErrors = [
		...errors,
		...(allCommandsSuccessful ? missingReports : []),
	];
	const matrix = stableObject(
		Object.entries(options.matrix).map(([key, value]) => [
			key,
			nullable(value, environment),
		]),
	);
	const artifactName = `ci-diagnostics-${plan.workflow
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}-${plan.jobId}${
		matrix.os
			? `-${String(matrix.os)
					.toLowerCase()
					.replace(/[^a-z0-9-]+/g, "-")}`
			: ""
	}`;
	const diagnostic = {
		schemaVersion: SCHEMA_VERSION,
		kind: DIAGNOSTIC_KIND,
		status: "success",
		workflow: workflowMetadata(plan, environment),
		runner: await runnerMetadata(environment),
		matrix,
		commands,
		reports: reports.map(({ candidates, ...report }) => report),
		summary: {
			failureEvidence: selectEvidence(commands, reports),
			outputTruncated: commands.some(
				({ evidence }) =>
					evidence.stdout.truncated || evidence.stderr.truncated,
			),
			missingReports,
			finalizationErrors,
			artifactName,
			artifactFiles: [],
		},
		sanitization: {
			applied: true,
			bestEffort: true,
			fullEnvironmentCollected: false,
			eventPayloadCollected: false,
			fullLogsCollected: false,
			limits: {
				commandTailLines: 100,
				lineCharacters: 1_024,
				errorCandidates: MAX_ERROR_CANDIDATES,
				diagnosticBytes: MAX_DIAGNOSTIC_BYTES,
			},
		},
	};
	diagnostic.status = overallStatus(
		options.jobStatus ?? "success",
		commands,
		finalizationErrors,
	);
	diagnostic.summary.artifactFiles = artifactAllowlist(plan, reports);
	let summary = renderSummary(diagnostic, artifactName);
	if (jsonBytes(diagnostic) > MAX_DIAGNOSTIC_BYTES) {
		diagnostic.summary.failureEvidence =
			diagnostic.summary.failureEvidence.slice(0, 3);
		for (const command of diagnostic.commands) {
			command.evidence.candidates = command.evidence.candidates.slice(0, 1);
		}
	}
	if (jsonBytes(diagnostic) > MAX_DIAGNOSTIC_BYTES) {
		throw new Error("Final diagnostic exceeded its size limit.");
	}
	await atomicWrite(
		safeChild(directory, "ci-diagnostic.json"),
		`${JSON.stringify(diagnostic, null, 2)}\n`,
	);
	await atomicWrite(safeChild(directory, "summary.md"), summary);
	let appendError = null;
	if (environment.GITHUB_STEP_SUMMARY) {
		try {
			try {
				const details = await lstat(environment.GITHUB_STEP_SUMMARY);
				if (details.isSymbolicLink() || !details.isFile()) {
					throw new Error("GITHUB_STEP_SUMMARY is not a regular file.");
				}
			} catch (error) {
				if (error?.code !== "ENOENT") throw error;
			}
			await appendFile(environment.GITHUB_STEP_SUMMARY, summary);
		} catch (error) {
			appendError = sanitizeText(error.message, environment).slice(0, 500);
			diagnostic.status = "failure";
			diagnostic.summary.finalizationErrors.push(
				`summary-append: ${appendError}`,
			);
			summary = renderSummary(diagnostic, artifactName);
			await atomicWrite(
				safeChild(directory, "ci-diagnostic.json"),
				`${JSON.stringify(diagnostic, null, 2)}\n`,
			);
			await atomicWrite(safeChild(directory, "summary.md"), summary);
		}
	}
	await pruneArtifactDirectory(directory, artifactAllowlist(plan, reports));
	return {
		diagnostic,
		appendError,
		exitCode:
			appendError ||
			(options.jobStatus !== "failure" && finalizationErrors.length)
				? 1
				: 0,
	};
}

async function main() {
	try {
		const options = parseFinalizeArguments(process.argv.slice(2));
		const result = await finalize(options);
		if (result.appendError) {
			process.stderr.write(
				`[ci-diagnostics] finalize failed while appending Job Summary: ${result.appendError}\n`,
			);
		} else {
			process.stdout.write(
				`[ci-diagnostics] finalized ${options.plan}: ${result.diagnostic.status}\n`,
			);
		}
		if (result.diagnostic.summary.finalizationErrors.length > 0) {
			const errors = sanitizeText(
				result.diagnostic.summary.finalizationErrors.join("; "),
			)
				.replace(/\r?\n/g, " ")
				.slice(0, 2_000);
			process.stderr.write(
				`[ci-diagnostics] finalize evidence errors: ${errors}\n`,
			);
		}
		process.exitCode = result.exitCode;
	} catch (error) {
		process.stderr.write(
			`[ci-diagnostics] finalize failed: ${sanitizeText(error instanceof Error ? error.message : String(error))}\n`,
		);
		process.exitCode = 1;
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await main();
}
