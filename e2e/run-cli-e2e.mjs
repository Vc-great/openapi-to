import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
	assert,
	exists,
	listFiles,
	manifestPaths,
	outputHashes,
	parseJsonStdout,
	repositoryRoot,
	runAlias,
	runLogged,
	runtimeMetadata,
	writeJson,
} from "./cli-e2e-utils.mjs";

const mode = process.argv[2];
const modes = {
	common: {
		config: "openapi.config.js",
		fixture: "petstore.json",
		primaryAlias: "openapi",
		secondaryAlias: "openapi-to",
		target: "local-json",
	},
	module: {
		config: "openapi.config.ts",
		fixture: "petstore.yaml",
		primaryAlias: "openapi-to",
		secondaryAlias: "openapi",
		target: "local-yaml",
	},
};

if (!Object.hasOwn(modes, mode)) {
	throw new Error("Usage: node e2e/run-cli-e2e.mjs <common|module>");
}

const settings = modes[mode];
const consumerRoot = path.join(repositoryRoot, "e2e", mode);
const workspace = await mkdtemp(
	path.join(consumerRoot, ".openapi-to-e2e-work-"),
);
const generatedRoot = path.join(workspace, ".openapi-to", "server");
const stateRoot = path.join(workspace, ".openapi-to");
const artifactDirectory = path.resolve(
	process.env.CLI_E2E_ARTIFACT_DIR ??
		path.join(repositoryRoot, ".ci-artifacts", "cli", mode),
);
const summary = {
	mode,
	status: "running",
	stage: "setup",
	settings,
	runtime: runtimeMetadata(),
	commands: [],
};

await rm(artifactDirectory, { recursive: true, force: true });
await mkdir(artifactDirectory, { recursive: true });
await writeJson(path.join(artifactDirectory, "runtime.json"), summary.runtime);
await writeJson(path.join(workspace, "package.json"), {
	name: `openapi-to-${mode}-e2e-workspace`,
	private: true,
	type: mode === "module" ? "module" : "commonjs",
});

assert(
	!(await exists(stateRoot)),
	`${path.relative(repositoryRoot, stateRoot)} unexpectedly exists in the new E2E workspace.`,
);
await copyFile(
	path.join(repositoryRoot, "e2e", "fixtures", settings.fixture),
	path.join(workspace, settings.fixture),
);

async function recordCommand(label, operation) {
	summary.stage = label;
	const result = await operation();
	summary.commands.push({
		label,
		command: result.command,
		args: result.args,
		exitCode: result.code,
		signal: result.signal,
	});
	return result;
}

async function collectArtifacts() {
	if (await exists(path.join(workspace, settings.config))) {
		await writeFile(
			path.join(artifactDirectory, path.basename(settings.config)),
			await readFile(path.join(workspace, settings.config)),
		);
	}
	const files = await listFiles(generatedRoot);
	await writeFile(
		path.join(artifactDirectory, "generated-files.txt"),
		files
			.map(({ path: filePath, bytes }) => `${bytes}\t${filePath}`)
			.join("\n") + (files.length ? "\n" : ""),
	);
	const manifestPath = path.join(generatedRoot, ".openapi-to-manifest.json");
	if (await exists(manifestPath)) {
		await writeFile(
			path.join(artifactDirectory, "ownership-manifest.json"),
			await readFile(manifestPath),
		);
	}
}

try {
	const initialized = await recordCommand("01-init", () =>
		runAlias({
			alias: settings.primaryAlias,
			args: ["init"],
			artifactDirectory,
			consumerRoot,
			cwd: workspace,
			label: "01-init",
		}),
	);
	assert(initialized.code === 0, `init exited with ${initialized.code}.`);

	const configured = await recordCommand("02-configure", () =>
		runLogged({
			command: process.execPath,
			args: [path.join(consumerRoot, "editPlugins.cjs")],
			artifactDirectory,
			cwd: workspace,
			env: {
				...process.env,
				CLI_E2E_CONFIG_PATH: path.join(workspace, settings.config),
				CLI_E2E_INPUT_PATH: settings.fixture,
			},
			label: "02-configure",
		}),
	);
	assert(
		configured.code === 0,
		`configuration exited with ${configured.code}.`,
	);
	await writeJson(path.join(artifactDirectory, "fixture.json"), {
		kind: mode === "common" ? "local-json" : "local-yaml",
		path: settings.fixture,
	});

	const generated = await recordCommand("03-generate", () =>
		runAlias({
			alias: settings.primaryAlias,
			args: ["generate", "--json"],
			artifactDirectory,
			consumerRoot,
			cwd: workspace,
			label: "03-generate",
		}),
	);
	const generatedJson = parseJsonStdout(generated, "generate");
	assert(
		generatedJson.success === true,
		"Generate JSON did not report success.",
	);
	assert(
		JSON.stringify(generatedJson.servers?.map((server) => server.name)) ===
			JSON.stringify([settings.target]),
		"Generate JSON did not report the expected target.",
	);

	const files = await listFiles(generatedRoot);
	const generatedFiles = files.filter(
		(file) => file.path !== ".openapi-to-manifest.json",
	);
	assert(generatedFiles.length > 0, "Generate produced no managed files.");
	assert(
		generatedFiles.every((file) => file.bytes > 0),
		"Generate produced an empty managed file.",
	);
	for (const suffix of [".model.ts", ".schema.ts", ".service.ts"]) {
		assert(
			generatedFiles.some((file) => file.path.endsWith(suffix)),
			`Generate produced no critical ${suffix} artifact.`,
		);
	}
	const manifest = JSON.parse(
		await readFile(
			path.join(generatedRoot, ".openapi-to-manifest.json"),
			"utf8",
		),
	);
	assert(
		JSON.stringify(manifestPaths(manifest)) ===
			JSON.stringify(generatedFiles.map((file) => file.path).sort()),
		"Ownership manifest paths do not match the generated file set.",
	);
	const before = await outputHashes(generatedRoot);

	const checked = await recordCommand("04-alias-check", () =>
		runAlias({
			alias: settings.secondaryAlias,
			args: ["generate", "--check", "--json"],
			artifactDirectory,
			consumerRoot,
			cwd: workspace,
			label: "04-alias-check",
		}),
	);
	const checkedJson = parseJsonStdout(checked, "alias check");
	assert(checkedJson.success === true, "Alias check did not report success.");
	assert(
		JSON.stringify(before) ===
			JSON.stringify(await outputHashes(generatedRoot)),
		"The secondary alias changed generated bytes.",
	);

	summary.status = "passed";
	summary.stage = "complete";
	summary.target = settings.target;
	summary.generatedFiles = generatedFiles.length;
	summary.aliases = [settings.primaryAlias, settings.secondaryAlias];
} catch (error) {
	summary.status = "failed";
	summary.error = error instanceof Error ? error.message : String(error);
	process.exitCode = 1;
} finally {
	await collectArtifacts();
	await writeJson(path.join(artifactDirectory, "summary.json"), summary);
	await rm(workspace, { recursive: true, force: true });
}

if (process.exitCode) {
	process.stderr.write(
		`[cli-e2e] ${mode} failed at ${summary.stage}: ${summary.error}\n`,
	);
} else {
	process.stdout.write(
		`[cli-e2e] ${mode} passed with ${summary.generatedFiles} managed files and both CLI aliases.\n`,
	);
}
