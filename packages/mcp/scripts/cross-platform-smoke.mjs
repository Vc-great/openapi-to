import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { sanitizeText } from "../../../scripts/ci-diagnostics/sanitize.mjs";

const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const repositoryRoot = path.resolve(packageRoot, "../..");
const bin = path.join(packageRoot, "bin", "openapi-to-mcp.js");
const artifactDirectory = path.resolve(
	process.env.MCP_TEST_ARTIFACT_DIR ??
		path.join(repositoryRoot, ".ci-artifacts", "mcp", "cross-platform-smoke"),
);
const rootManifest = JSON.parse(
	await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
);
const observation = {
	stage: "spawn",
	status: "running",
	platform: process.platform,
	arch: process.arch,
	node: process.version,
	pnpm: rootManifest.packageManager,
	processExecPath: path.basename(process.execPath),
	command: path.basename(process.execPath),
	args: [
		path.relative(repositoryRoot, bin).split(path.sep).join("/"),
		"--workspace-root",
		".",
	],
	cwd: ".",
	pid: null,
	childExitCode: null,
	childSignal: null,
	milestones: [],
};
const stderr = [];
let childClosedResolve;
const childClosed = new Promise((resolve) => {
	childClosedResolve = resolve;
});

function redact(value) {
	return sanitizeText(value).slice(0, 128 * 1024);
}

async function withDeadline(stage, operation, timeoutMs = 20_000) {
	observation.stage = stage;
	let timer;
	try {
		return await Promise.race([
			operation,
			new Promise((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`${stage} exceeded ${timeoutMs} ms.`)),
					timeoutMs,
				);
				timer.unref();
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

class ObservedStdioClientTransport extends StdioClientTransport {
	async start() {
		await super.start();
		const child = this._process;
		this.observedChild = child;
		observation.pid = child?.pid ?? null;
		observation.milestones.push("spawn");
		child?.once("exit", (code, signal) => {
			observation.childExitCode = code;
			observation.childSignal = signal;
		});
		child?.once("close", () => {
			observation.milestones.push("child-close");
			childClosedResolve();
		});
	}

	terminateObservedChild() {
		const child = this.observedChild;
		if (child && child.exitCode === null && child.signalCode === null) {
			child.kill("SIGKILL");
			observation.milestones.push("cleanup/terminate-child");
		}
	}
}

await mkdir(artifactDirectory, { recursive: true });
const transport = new ObservedStdioClientTransport({
	command: process.execPath,
	args: [bin, "--workspace-root", repositoryRoot],
	cwd: repositoryRoot,
	stderr: "pipe",
});
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
const client = new Client({
	name: "openapi-to-cross-platform-smoke",
	version: "1.0.0",
});
let closed = false;

try {
	await withDeadline("initialize", client.connect(transport));
	observation.milestones.push("initialize");

	const listed = await withDeadline("tools/list", client.listTools());
	const names = listed.tools.map(({ name }) => name);
	if (
		JSON.stringify(names) !==
		JSON.stringify(["openapi_validate", "openapi_inspect", "openapi_diff"])
	) {
		throw new Error(
			`tools/list returned an unexpected tool set: ${names.join(", ")}`,
		);
	}
	observation.milestones.push("tools/list");

	const validated = await withDeadline(
		"openapi_validate",
		client.callTool({
			name: "openapi_validate",
			arguments: { source: "packages/mcp/src/fixtures/valid.yaml" },
		}),
	);
	if (
		validated.isError === true ||
		validated.structuredContent?.success !== true
	) {
		throw new Error("openapi_validate did not return a successful result.");
	}
	observation.milestones.push("openapi_validate");

	await withDeadline("client.close", client.close());
	closed = true;
	observation.milestones.push("client.close");
	await withDeadline("child-close", childClosed, 5_000);
	if (transport.pid !== null) {
		throw new Error("The MCP child process still has a live pid after close.");
	}
	if (observation.childExitCode !== 0 || observation.childSignal !== null) {
		throw new Error(
			`The MCP child exited with code ${observation.childExitCode} and signal ${observation.childSignal}.`,
		);
	}
	observation.milestones.push("no-orphan-process");
	observation.stage = "complete";
	observation.status = "passed";
} catch (error) {
	observation.status = "failed";
	observation.error = sanitizeText(
		error instanceof Error ? error.message : String(error),
	).slice(0, 2_000);
	process.exitCode = 1;
} finally {
	if (!closed) {
		try {
			await Promise.race([
				client.close(),
				new Promise((_, reject) => {
					const timer = setTimeout(
						() => reject(new Error("client cleanup exceeded 6 seconds.")),
						6_000,
					);
					timer.unref();
				}),
			]);
		} catch {
			// Preserve the original failure; stderr and lifecycle state are retained below.
		}
		transport.terminateObservedChild();
		if (
			observation.pid !== null &&
			!observation.milestones.includes("child-close")
		) {
			try {
				await Promise.race([
					childClosed,
					new Promise((_, reject) => {
						const timer = setTimeout(
							() => reject(new Error("child cleanup exceeded 5 seconds.")),
							5_000,
						);
						timer.unref();
					}),
				]);
			} catch {
				observation.milestones.push("cleanup/child-close-timeout");
			}
		}
	}
	await Promise.all([
		writeFile(
			path.join(artifactDirectory, "mcp-stderr.log"),
			redact(stderr.join("")),
		),
		writeFile(
			path.join(artifactDirectory, "mcp-cross-platform-smoke.json"),
			`${JSON.stringify(observation, null, 2)}\n`,
		),
	]);
}

if (process.exitCode) {
	process.stderr.write(
		`[mcp-smoke] failed at ${observation.stage}: ${observation.error}\n`,
	);
} else {
	process.stdout.write(
		"[mcp-smoke] spawn, initialize, tools/list, validate, close, and child exit passed.\n",
	);
}
