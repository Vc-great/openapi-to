import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { atomicWrite, repositoryRoot } from "./filesystem.mjs";
import { artifactAllowlist, finalize, renderSummary } from "./finalize-job.mjs";
import { initialize } from "./initialize.mjs";
import { getPlan } from "./plans.mjs";
import { resolveInvocation, runCommand } from "./run-command.mjs";
import { markdownCell, sanitizeCommand, sanitizeText } from "./sanitize.mjs";
import {
	DIAGNOSTIC_KIND,
	jsonBytes,
	MAX_COMMAND_REPORT_BYTES,
	MAX_DIAGNOSTIC_BYTES,
	MAX_LINE_CHARS,
	MAX_TAIL_LINES,
	SCHEMA_VERSION,
} from "./schema.mjs";

const execFileAsync = promisify(execFile);
const runCommandPath = path.join(
	repositoryRoot,
	"scripts/ci-diagnostics/run-command.mjs",
);

async function fixture(t, planId = "quality-build") {
	const root = await mkdtemp(
		path.join(os.tmpdir(), "openapi-to-ci-diagnostics-"),
	);
	t.after(() => rm(root, { recursive: true, force: true }));
	const directory = path.join(root, "diagnostic");
	const environment = {
		...process.env,
		GITHUB_WORKSPACE: repositoryRoot,
		RUNNER_TEMP: root,
		HOME: path.join(root, "home"),
	};
	await initialize({ dir: directory, plan: planId }, environment);
	return { root, directory, environment, plan: getPlan(planId) };
}

function commandReport(expected, overrides = {}) {
	return {
		schemaVersion: SCHEMA_VERSION,
		kind: "openapi-to-ci-command",
		id: expected.id,
		label: expected.label,
		status: "success",
		exitCode: 0,
		signal: null,
		durationMs: 5,
		command: ["node", "--version"],
		cwd: ".",
		evidence: {
			stdout: {
				tail: [],
				totalLines: 0,
				truncated: false,
				truncatedLines: 0,
				candidates: [],
			},
			stderr: {
				tail: [],
				totalLines: 0,
				truncated: false,
				truncatedLines: 0,
				candidates: [],
			},
			spawnError: null,
		},
		...overrides,
	};
}

async function writeCommandReports(directory, plan, overrides = {}) {
	for (const expected of plan.commands) {
		const report = commandReport(expected, overrides[expected.id] ?? {});
		await atomicWrite(
			path.join(directory, "commands", `${expected.id}.json`),
			`${JSON.stringify(report, null, 2)}\n`,
		);
	}
}

async function withoutProcessOutput(operation) {
	const stdoutWrite = process.stdout.write;
	const stderrWrite = process.stderr.write;
	process.stdout.write = () => true;
	process.stderr.write = () => true;
	try {
		return await operation();
	} finally {
		process.stdout.write = stdoutWrite;
		process.stderr.write = stderrWrite;
	}
}

test("command wrapper streams stdout and records a successful command", async (t) => {
	const { directory, environment } = await fixture(t);
	const result = await execFileAsync(
		process.execPath,
		[
			runCommandPath,
			"--dir",
			directory,
			"--id",
			"build",
			"--",
			process.execPath,
			"-e",
			"process.stdout.write('visible-output\\n')",
		],
		{ env: environment },
	);
	assert.match(result.stdout, /visible-output/);
	const report = JSON.parse(
		await readFile(path.join(directory, "commands/build.json"), "utf8"),
	);
	assert.equal(report.status, "success");
	assert.equal(report.exitCode, 0);
});

test("command wrapper preserves a failing exit code", async (t) => {
	const { directory, environment } = await fixture(t);
	await assert.rejects(
		execFileAsync(
			process.execPath,
			[
				runCommandPath,
				"--dir",
				directory,
				"--id",
				"build",
				"--",
				process.execPath,
				"-e",
				"process.exit(7)",
			],
			{ env: environment },
		),
		(error) => error.code === 7,
	);
	const report = JSON.parse(
		await readFile(path.join(directory, "commands/build.json"), "utf8"),
	);
	assert.equal(report.status, "failure");
	assert.equal(report.exitCode, 7);
});

test(
	"command wrapper records a signal as a non-successful exit",
	{ skip: process.platform === "win32" },
	async (t) => {
		const { directory, environment } = await fixture(t);
		await assert.rejects(
			execFileAsync(
				process.execPath,
				[
					runCommandPath,
					"--dir",
					directory,
					"--id",
					"build",
					"--",
					process.execPath,
					"-e",
					"process.kill(process.pid, 'SIGTERM')",
				],
				{ env: environment },
			),
		);
		const report = JSON.parse(
			await readFile(path.join(directory, "commands/build.json"), "utf8"),
		);
		assert.equal(report.status, "signalled");
		assert.equal(report.signal, "SIGTERM");
	},
);

test("command wrapper distinguishes timeout and terminates the child", async (t) => {
	const { directory, environment } = await fixture(t);
	const started = Date.now();
	await assert.rejects(
		execFileAsync(
			process.execPath,
			[
				runCommandPath,
				"--dir",
				directory,
				"--id",
				"build",
				"--timeout-ms",
				"100",
				"--",
				process.execPath,
				"-e",
				"setInterval(() => {}, 1000)",
			],
			{ env: environment, timeout: 5_000 },
		),
	);
	assert.ok(Date.now() - started < 5_000);
	const report = JSON.parse(
		await readFile(path.join(directory, "commands/build.json"), "utf8"),
	);
	assert.equal(report.status, "timeout");
	assert.notEqual(report.exitCode, 0);
});

test("command spawn failure is an infrastructure error", async (t) => {
	const { directory, environment } = await fixture(t);
	const result = await runCommand(
		{
			dir: directory,
			id: "build",
			command: ["definitely-missing-openapi-to-command"],
			timeoutMs: null,
		},
		environment,
	);
	assert.equal(result.exitCode, 1);
	assert.equal(result.report.status, "infrastructure-error");
	assert.match(result.report.evidence.spawnError, /ENOENT/);
});

test("command report write failure cannot turn a gate failure into success", async (t) => {
	const { directory, environment } = await fixture(t);
	await assert.rejects(
		runCommand(
			{
				dir: directory,
				id: "build",
				command: [process.execPath, "-e", "process.exit(6)"],
				timeoutMs: null,
			},
			environment,
			{
				writeReport: async () => {
					throw new Error("simulated atomic write failure");
				},
			},
		),
		(error) =>
			error.message === "simulated atomic write failure" &&
			error.commandExitCode === 6,
	);
});

test("stdout and stderr tails, long lines, ANSI, and JSON size stay bounded", async (t) => {
	const { directory, environment } = await fixture(t);
	const script =
		"for(let i=0;i<250;i++){console.log('\\u001b[31mline-'+i+'-'+ 'x'.repeat(2000)+'\\u001b[0m');console.error('error-'+i+'-'+ 'y'.repeat(2000))}";
	const result = await withoutProcessOutput(() =>
		runCommand(
			{
				dir: directory,
				id: "build",
				command: [process.execPath, "-e", script],
				timeoutMs: null,
			},
			environment,
		),
	);
	assert.equal(result.report.evidence.stdout.tail.length, MAX_TAIL_LINES);
	assert.equal(result.report.evidence.stderr.tail.length, MAX_TAIL_LINES);
	assert.equal(result.report.evidence.stdout.truncated, true);
	assert.equal(result.report.evidence.stderr.truncated, true);
	assert.ok(
		result.report.evidence.stdout.tail.every(
			(line) => line.length <= MAX_LINE_CHARS + 18,
		),
	);
	assert.ok(!JSON.stringify(result.report).includes("\u001b"));
	assert.ok(jsonBytes(result.report) <= MAX_COMMAND_REPORT_BYTES);
});

test("pnpm invocation uses npm_execpath and has a Windows fallback", () => {
	assert.deepEqual(
		resolveInvocation("pnpm", ["build"], {
			platform: "win32",
			npmExecPath: "C:\\pnpm\\pnpm.cjs",
			execPath: "C:\\node\\node.exe",
		}),
		{
			command: "C:\\node\\node.exe",
			args: ["C:\\pnpm\\pnpm.cjs", "build"],
		},
	);
	assert.deepEqual(
		resolveInvocation("pnpm", ["build"], {
			platform: "win32",
			npmExecPath: "",
		}),
		{ command: "pnpm.cmd", args: ["build"] },
	);
});

test("command ids and diagnostic path traversal are rejected", async (t) => {
	const { directory, environment } = await fixture(t);
	await assert.rejects(
		runCommand(
			{
				dir: directory,
				id: "../build",
				command: [process.execPath, "--version"],
				timeoutMs: null,
			},
			environment,
		),
		/Command id/,
	);
	await assert.rejects(
		initialize(
			{ dir: path.join(directory, "../../../outside"), plan: "quality-build" },
			{ ...environment, RUNNER_TEMP: directory },
		),
		/outside the authorized roots/,
	);
});

test("symlink diagnostic directories are rejected", async (t) => {
	const { root, environment } = await fixture(t);
	const real = path.join(root, "real");
	const link = path.join(root, "link");
	await mkdir(real);
	try {
		await symlink(
			real,
			link,
			process.platform === "win32" ? "junction" : "dir",
		);
	} catch (error) {
		if (process.platform === "win32" && error.code === "EPERM") {
			t.skip("Creating junctions is not permitted on this runner.");
			return;
		}
		throw error;
	}
	await assert.rejects(
		initialize({ dir: link, plan: "quality-build" }, environment),
		/symlink/,
	);
});

test("replaced command and known-report directories are rejected", async (t) => {
	const commandFixture = await fixture(t);
	const outsideCommands = path.join(commandFixture.root, "outside-commands");
	await mkdir(outsideCommands);
	await rm(path.join(commandFixture.directory, "commands"), {
		recursive: true,
		force: true,
	});
	try {
		await symlink(
			outsideCommands,
			path.join(commandFixture.directory, "commands"),
			process.platform === "win32" ? "junction" : "dir",
		);
	} catch (error) {
		if (process.platform === "win32" && error.code === "EPERM") {
			t.skip("Creating junctions is not permitted on this runner.");
			return;
		}
		throw error;
	}
	await assert.rejects(
		runCommand(
			{
				dir: commandFixture.directory,
				id: "build",
				command: [process.execPath, "--version"],
				timeoutMs: null,
			},
			commandFixture.environment,
		),
		/symlink/,
	);
	await assert.rejects(
		readFile(path.join(outsideCommands, "build.json")),
		/ENOENT/,
	);

	const reportFixture = await fixture(t);
	const outsideReports = path.join(reportFixture.root, "outside-reports");
	await mkdir(outsideReports);
	await rm(path.join(reportFixture.directory, "known-reports"), {
		recursive: true,
		force: true,
	});
	await symlink(
		outsideReports,
		path.join(reportFixture.directory, "known-reports"),
		process.platform === "win32" ? "junction" : "dir",
	);
	await assert.rejects(
		finalize(
			{
				dir: reportFixture.directory,
				plan: "quality-build",
				jobStatus: "success",
				matrix: {},
			},
			reportFixture.environment,
		),
		/symlink/,
	);
});

test("sanitization redacts headers, tokens, URLs, and known paths", () => {
	const environment = {
		GITHUB_WORKSPACE: "/work/repo",
		RUNNER_TEMP: "/runner/temp",
		HOME: "/home/runner",
	};
	const value = sanitizeText(
		[
			"Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
			"Cookie: session=secret",
			"Set-Cookie: session=secret",
			"ghp_abcdefghijklmnopqrstuvwxyz123456",
			"npm_abcdefghijklmnopqrstuvwxyz123456",
			"https://alice:password@example.test/private?token=secret",
			"/work/repo/file.ts /runner/temp/out /home/runner/.npmrc",
		].join("\n"),
		environment,
	);
	assert.doesNotMatch(
		value,
		/abcdefghijklmnopqrstuvwxyz|session=secret|password|token=secret/,
	);
	assert.match(value, /Authorization: \[REDACTED\]/);
	assert.match(value, /<workspace>\/file\.ts/);
	assert.match(value, /<runner-temp>\/out/);
	assert.match(value, /<home>\/\.npmrc/);
});

test("sanitization preserves ordinary errors and redacts command secret arguments", () => {
	assert.equal(
		sanitizeText("TypeError: expected widget to exist"),
		"TypeError: expected widget to exist",
	);
	assert.deepEqual(
		sanitizeCommand([
			"tool",
			"--token",
			"secret-value",
			"--api-key=secret",
			"https://example.test/a?q=secret",
		]),
		[
			"tool",
			"--token",
			"[REDACTED]",
			"--api-key=[REDACTED]",
			"https://example.test/a?[REDACTED]",
		],
	);
});

test("Markdown and HTML from untrusted text cannot change summary structure", () => {
	const escaped = markdownCell(
		"</td></tr><script>alert(1)</script> | [click](https://evil.test)\nnext",
	);
	assert.doesNotMatch(escaped, /<script>|\| \[click\]\(/);
	assert.match(escaped, /&lt;\/td&gt;/);
	assert.match(escaped, /\\\|/);
});

test("finalizer records all-success commands in plan order", async (t) => {
	const { directory, environment, plan } = await fixture(
		t,
		"quality-typecheck",
	);
	await writeCommandReports(directory, plan);
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-typecheck",
			jobStatus: "success",
			matrix: { zeta: "two", alpha: "one" },
		},
		environment,
	);
	assert.equal(result.exitCode, 0);
	assert.equal(result.diagnostic.status, "success");
	assert.deepEqual(
		result.diagnostic.commands.map(({ id }) => id),
		plan.commands.map(({ id }) => id),
	);
	assert.deepEqual(Object.keys(result.diagnostic.matrix), ["alpha", "zeta"]);
	assert.equal(result.diagnostic.schemaVersion, SCHEMA_VERSION);
	assert.equal(result.diagnostic.kind, DIAGNOSTIC_KIND);
	assert.ok(jsonBytes(result.diagnostic) <= MAX_DIAGNOSTIC_BYTES);
});

test("finalizer records a failure followed by explicit not-run commands", async (t) => {
	const { directory, environment, plan } = await fixture(
		t,
		"quality-typecheck",
	);
	await atomicWrite(
		path.join(directory, "commands/build.json"),
		`${JSON.stringify(
			commandReport(plan.commands[0], { status: "failure", exitCode: 2 }),
			null,
			2,
		)}\n`,
	);
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-typecheck",
			jobStatus: "failure",
			matrix: {},
		},
		environment,
	);
	assert.equal(result.exitCode, 0);
	assert.equal(result.diagnostic.status, "failure");
	assert.deepEqual(
		result.diagnostic.commands.map(({ status }) => status),
		["failure", "not-run", "not-run"],
	);
});

test("missing, corrupt, and symlink known reports are distinguished", async (t) => {
	const { root, directory, environment, plan } = await fixture(t, "e2e-common");
	await writeCommandReports(directory, plan);
	const reportDirectory = path.join(root, "cli");
	await mkdir(reportDirectory);
	await writeFile(path.join(reportDirectory, "runtime.json"), "{broken");
	const outside = path.join(root, "outside.json");
	await writeFile(outside, "{}\n");
	try {
		await symlink(
			outside,
			path.join(reportDirectory, "summary.json"),
			process.platform === "win32" ? "file" : undefined,
		);
	} catch (error) {
		if (process.platform === "win32" && error.code === "EPERM") {
			t.skip("Creating file symlinks is not permitted on this runner.");
			return;
		}
		throw error;
	}
	const result = await finalize(
		{
			dir: directory,
			plan: "e2e-common",
			jobStatus: "success",
			matrix: {},
		},
		{ ...environment, CLI_E2E_ARTIFACT_DIR: reportDirectory },
	);
	assert.equal(result.exitCode, 1);
	assert.deepEqual(
		result.diagnostic.reports.slice(0, 2).map(({ parseStatus }) => parseStatus),
		["invalid", "rejected"],
	);
});

test("finalizer handles no command reports without guessing success", async (t) => {
	const { directory, environment } = await fixture(t, "quality-tests");
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-tests",
			jobStatus: "failure",
			matrix: {},
		},
		environment,
	);
	assert.equal(result.diagnostic.status, "failure");
	assert.deepEqual(
		result.diagnostic.commands.map(({ status }) => status),
		["not-run", "not-run"],
	);
});

test("artifact allowlist excludes unknown files", async (t) => {
	const { directory, environment, plan } = await fixture(t);
	await writeCommandReports(directory, plan);
	await writeFile(path.join(directory, "unknown-secret.txt"), "do not upload");
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-build",
			jobStatus: "success",
			matrix: {},
		},
		environment,
	);
	const allowlist = artifactAllowlist(plan, result.diagnostic.reports);
	assert.ok(!allowlist.includes("unknown-secret.txt"));
	assert.deepEqual(result.diagnostic.summary.artifactFiles, allowlist);
	await assert.rejects(
		readFile(path.join(directory, "unknown-secret.txt")),
		/ENOENT/,
	);
});

test("local finalization creates summary.md without GITHUB_STEP_SUMMARY", async (t) => {
	const { directory, environment, plan } = await fixture(t);
	await writeCommandReports(directory, plan);
	delete environment.GITHUB_STEP_SUMMARY;
	await finalize(
		{
			dir: directory,
			plan: "quality-build",
			jobStatus: "success",
			matrix: {},
		},
		environment,
	);
	assert.match(
		await readFile(path.join(directory, "summary.md"), "utf8"),
		/## CI diagnostics/,
	);
});

test("finalizer creates and appends the GitHub Job Summary file", async (t) => {
	const { root, directory, environment, plan } = await fixture(t);
	await writeCommandReports(directory, plan);
	const summaryPath = path.join(root, "github-summary.md");
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-build",
			jobStatus: "success",
			matrix: {},
		},
		{ ...environment, GITHUB_STEP_SUMMARY: summaryPath },
	);
	assert.equal(result.exitCode, 0);
	assert.match(await readFile(summaryPath, "utf8"), /## CI diagnostics/);
});

test("Job Summary append failure is explicit and preserves command evidence", async (t) => {
	const { root, directory, environment, plan } = await fixture(t);
	await writeCommandReports(directory, plan, {
		build: { status: "failure", exitCode: 9 },
	});
	const result = await finalize(
		{
			dir: directory,
			plan: "quality-build",
			jobStatus: "failure",
			matrix: {},
		},
		{
			...environment,
			GITHUB_STEP_SUMMARY: path.join(root, "missing-parent", "summary.md"),
		},
	);
	assert.equal(result.exitCode, 1);
	assert.match(result.appendError, /ENOENT/);
	assert.equal(result.diagnostic.commands[0].exitCode, 9);
	assert.equal(result.diagnostic.status, "failure");
});

test("rendered summaries stay bounded and escape report-controlled evidence", () => {
	const diagnostic = {
		status: "failure",
		workflow: {
			name: "Quality",
			jobName: "Tests",
			commitSha: null,
		},
		runner: { os: "Linux", architecture: "x64" },
		commands: [
			{
				label: "bad | </td>",
				status: "failure",
				exitCode: 1,
				durationMs: 1,
			},
		],
		summary: {
			failureEvidence: Array.from({ length: 100 }, () => ({
				source: "report",
				kind: "structured-report",
				text: "<script>x</script> | [link](https://evil.test)".repeat(100),
			})),
			outputTruncated: true,
		},
	};
	const summary = renderSummary(diagnostic, "ci-diagnostics-quality-tests");
	assert.ok(summary.length <= 24 * 1024 + 30);
	assert.doesNotMatch(summary, /<script>|\| \[link\]\(/);
});

test("workflow contract keeps finalizers, failure artifacts, gates, and matrices", async () => {
	const workflows = await Promise.all(
		[
			["quality.yml", 5],
			["a1-cross-platform.yml", 1],
			["e2e.yaml", 7],
			["version-readiness.yml", 1],
		].map(async ([name, jobs]) => ({
			name,
			jobs,
			contents: await readFile(
				path.join(repositoryRoot, ".github/workflows", name),
				"utf8",
			),
		})),
	);
	for (const { name, jobs, contents } of workflows) {
		assert.equal(
			[...contents.matchAll(/- name: Finalize CI diagnostics/g)].length,
			jobs,
			name,
		);
		assert.equal(
			[
				...contents.matchAll(
					/- name: Finalize CI diagnostics\s*\n\s+if: always\(\)/g,
				),
			].length,
			jobs,
			name,
		);
		assert.equal(
			[
				...contents.matchAll(
					/- name: Upload CI failure diagnostics\s*\n\s+if: failure\(\)/g,
				),
			].length,
			jobs,
			name,
		);
		assert.doesNotMatch(contents, /continue-on-error/);
		assert.match(contents, /retention-days: 14/);
	}
	const quality = workflows.find(({ name }) => name === "quality.yml").contents;
	for (const command of [
		"pnpm build --concurrency=1",
		"pnpm typecheck --concurrency=1",
		"pnpm exec tsc -b",
		"pnpm test:vitest",
		"pnpm lint:changed --base",
		"pnpm release:smoke",
	]) {
		assert.match(
			quality,
			new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
		);
	}
	const a1 = workflows.find(
		({ name }) => name === "a1-cross-platform.yml",
	).contents;
	assert.match(a1, /os: \[ubuntu-latest, windows-latest, macos-latest\]/);
	assert.match(a1, /fail-fast: false/);
	const e2e = workflows.find(({ name }) => name === "e2e.yaml").contents;
	assert.equal(
		[...e2e.matchAll(/os: \[ubuntu-latest, windows-latest, macos-latest\]/g)]
			.length,
		4,
	);
	assert.equal([...e2e.matchAll(/fail-fast: false/g)].length, 4);
	assert.match(
		e2e,
		/mcp-performance:[\s\S]*if: github\.event_name != 'pull_request'/,
	);
	const versionPackages = await readFile(
		path.join(repositoryRoot, ".github/workflows/version-packages.yml"),
		"utf8",
	);
	assert.doesNotMatch(
		versionPackages,
		/ci-diagnostics|Finalize CI diagnostics|openai|codex/i,
	);
});
