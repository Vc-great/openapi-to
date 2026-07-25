import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
	assert,
	exists,
	listFiles,
	parseJsonStdout,
	repositoryRoot,
	runAlias,
	runtimeMetadata,
	writeJson,
} from "./cli-e2e-utils.mjs";

const consumerRoot = path.join(repositoryRoot, "e2e", "common");
const workspace = await mkdtemp(
	path.join(consumerRoot, ".openapi-to-e2e-remote-"),
);
const stateRoot = path.join(workspace, ".OpenAPI");
const artifactDirectory = path.resolve(
	process.env.CLI_E2E_ARTIFACT_DIR ??
		path.join(repositoryRoot, ".ci-artifacts", "cli", "remote"),
);
const fixtures = {
	json: await readFile(
		path.join(repositoryRoot, "e2e", "fixtures", "petstore.json"),
		"utf8",
	),
	yaml: await readFile(
		path.join(repositoryRoot, "e2e", "fixtures", "petstore.yaml"),
		"utf8",
	),
};
const summary = {
	mode: "remote",
	status: "running",
	stage: "setup",
	runtime: runtimeMetadata(),
	fixtures: [
		{ route: "/json", format: "json", contentType: "application/json" },
		{ route: "/yaml", format: "yaml", contentType: "application/yaml" },
		{
			route: "/wrong-content-type",
			format: "json",
			contentType: "text/plain",
		},
	],
	commands: [],
};

await rm(artifactDirectory, { recursive: true, force: true });
await mkdir(artifactDirectory, { recursive: true });
await writeJson(path.join(artifactDirectory, "runtime.json"), summary.runtime);
await writeJson(path.join(workspace, "package.json"), {
	name: "openapi-to-remote-e2e-workspace",
	private: true,
	type: "commonjs",
});
assert(
	!(await exists(stateRoot)),
	"Remote E2E state unexpectedly exists in the new E2E workspace.",
);

const server = createServer((request, response) => {
	if (request.url === "/json") {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(fixtures.json);
		return;
	}
	if (request.url === "/yaml") {
		response.writeHead(200, { "content-type": "application/yaml" });
		response.end(fixtures.yaml);
		return;
	}
	if (request.url === "/wrong-content-type") {
		response.writeHead(200, { "content-type": "text/plain" });
		response.end(fixtures.json);
		return;
	}
	response.writeHead(404, { "content-type": "text/plain" });
	response.end("not found");
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert(
	address && typeof address !== "string",
	"Unable to start the local HTTP fixture.",
);

function target(name, route, remote = true) {
	return `{
      name: '${name}',
      input: {
        path: 'http://127.0.0.1:${address.port}${route}',
        ${
					remote
						? "remote: { allowPrivateNetwork: true, allowedHosts: ['127.0.0.1'] },"
						: ""
				}
      },
      output: { dir: '${name}', clean: true },
    }`;
}

await mkdir(stateRoot);
const configPath = path.join(stateRoot, "openapi.config.js");
await writeFile(
	configPath,
	`const { defineConfig, pluginTSType } = require('openapi-to')

module.exports = defineConfig({
  servers: [
    ${target("remote-json", "/json")},
    ${target("remote-yaml", "/yaml")},
    ${target("remote-wrong-content", "/wrong-content-type")},
    ${target("remote-blocked", "/json", false)},
  ],
  plugins: [pluginTSType()],
})
`,
);
await writeFile(
	path.join(artifactDirectory, "openapi.config.js"),
	await readFile(configPath),
);
await writeJson(path.join(artifactDirectory, "fixture.json"), {
	host: "127.0.0.1",
	port: "random",
	routes: summary.fixtures,
});

async function run(label, args) {
	summary.stage = label;
	const result = await runAlias({
		alias: "openapi-to",
		args,
		artifactDirectory,
		consumerRoot,
		cwd: workspace,
		label,
	});
	summary.commands.push({
		label,
		exitCode: result.code,
		signal: result.signal,
		command: result.command,
		args: result.args.map((argument) =>
			argument.includes(`:${address.port}`) ? "<local-random-port>" : argument,
		),
	});
	return result;
}

async function collectFiles() {
	const lines = [];
	for (const name of [
		"remote-json",
		"remote-yaml",
		"remote-wrong-content",
		"remote-blocked",
	]) {
		for (const file of await listFiles(path.join(stateRoot, name))) {
			lines.push(`${name}\t${file.bytes}\t${file.path}`);
		}
		const manifest = path.join(stateRoot, name, ".openapi-to-manifest.json");
		if (await exists(manifest)) {
			await writeFile(
				path.join(artifactDirectory, `${name}-manifest.json`),
				await readFile(manifest),
			);
		}
	}
	await writeFile(
		path.join(artifactDirectory, "generated-files.txt"),
		`${lines.join("\n")}${lines.length ? "\n" : ""}`,
	);
}

try {
	const generated = await run("01-generate-local-http", [
		"generate",
		"--target",
		"remote-json",
		"--target",
		"remote-yaml",
		"--target",
		"remote-wrong-content",
		"--json",
	]);
	const generatedJson = parseJsonStdout(generated, "remote generate");
	assert(
		JSON.stringify(generatedJson.servers?.map((entry) => entry.name)) ===
			JSON.stringify(["remote-json", "remote-yaml", "remote-wrong-content"]),
		"Remote generation did not preserve configured target order.",
	);
	for (const name of ["remote-json", "remote-yaml", "remote-wrong-content"]) {
		const files = await listFiles(path.join(stateRoot, name));
		assert(
			files.some(
				(file) => file.path !== ".openapi-to-manifest.json" && file.bytes > 0,
			),
			`${name} produced no non-empty managed files.`,
		);
	}
	assert(
		!(await exists(path.join(stateRoot, "remote-blocked"))),
		"An unselected remote target wrote output.",
	);

	const blocked = await run("02-private-network-blocked", [
		"generate",
		"--target",
		"remote-blocked",
		"--json",
	]);
	assert(
		blocked.code === 4,
		`Blocked private-network input exited with ${blocked.code}, expected 4.`,
	);
	const blockedJson = JSON.parse(blocked.stdout);
	assert(
		blockedJson.diagnostics?.some(
			(diagnostic) => diagnostic.code === "REMOTE_SOURCE_BLOCKED",
		),
		"Blocked private-network input did not report REMOTE_SOURCE_BLOCKED.",
	);
	assert(
		!(await exists(path.join(stateRoot, "remote-blocked"))),
		"Blocked private-network input wrote output.",
	);

	summary.status = "passed";
	summary.stage = "complete";
} catch (error) {
	summary.status = "failed";
	summary.error = error instanceof Error ? error.message : String(error);
	process.exitCode = 1;
} finally {
	await collectFiles();
	await writeJson(path.join(artifactDirectory, "summary.json"), summary);
	await new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
	});
	await rm(stateRoot, { recursive: true, force: true });
	await rm(workspace, { recursive: true, force: true });
}

if (process.exitCode) {
	process.stderr.write(
		`[cli-e2e] remote failed at ${summary.stage}: ${summary.error}\n`,
	);
} else {
	process.stdout.write(
		"[cli-e2e] remote passed for local JSON, YAML, wrong Content-Type, and blocked private-network input.\n",
	);
}
