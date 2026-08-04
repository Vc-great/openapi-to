import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const consumerRoot = path.join(repositoryRoot, "e2e", "common");
const suffix = process.platform === "win32" ? ".cmd" : "";

function runAlias(
	name,
	args,
	environment,
	expectedStatus = 0,
	parseJson = true,
) {
	const executable = path.join(
		consumerRoot,
		"node_modules",
		".bin",
		`${name}${suffix}`,
	);
	const childEnvironment = {
		...process.env,
		CI: "1",
		...environment,
	};
	delete childEnvironment.NO_UPDATE_NOTIFIER;
	const result = spawnSync(executable, args, {
		cwd: consumerRoot,
		encoding: "utf8",
		env: childEnvironment,
		shell: process.platform === "win32",
	});
	if (result.error) throw result.error;
	if (result.status !== expectedStatus) {
		throw new Error(
			`${name} ${args.join(" ")} exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
		);
	}
	if (result.stderr !== "") {
		throw new Error(`${name} wrote unexpected stderr: ${result.stderr}`);
	}
	return parseJson ? JSON.parse(result.stdout) : result;
}

async function hashes(root, manifest) {
	const result = {};
	for (const skill of manifest.skills) {
		for (const file of skill.files) {
			const key = `${skill.name}/${file.path}`;
			const bytes = await readFile(
				path.join(root, skill.name, ...file.path.split("/")),
			);
			result[key] = createHash("sha256").update(bytes).digest("hex");
		}
	}
	return result;
}

const temporaryRoot = await mkdtemp(
	path.join(tmpdir(), "openapi-to-codex-skills-cross-platform-"),
);
const codexHome = path.join(temporaryRoot, "Codex Home with spaces 空格");
const notifierConfigRoots = [
	path.join(temporaryRoot, "User Home"),
	path.join(temporaryRoot, "XDG Config"),
	path.join(temporaryRoot, "App Data"),
	path.join(temporaryRoot, "Local App Data"),
];
const environment = {
	CODEX_HOME: codexHome,
	HOME: notifierConfigRoots[0],
	USERPROFILE: notifierConfigRoots[0],
	XDG_CONFIG_HOME: notifierConfigRoots[1],
	APPDATA: notifierConfigRoots[2],
	LOCALAPPDATA: notifierConfigRoots[3],
};
try {
	const openapiBinary = path.join(
		consumerRoot,
		"node_modules",
		".bin",
		`openapi${suffix}`,
	);
	const openapiToBinary = path.join(
		consumerRoot,
		"node_modules",
		".bin",
		`openapi-to${suffix}`,
	);
	await Promise.all([access(openapiBinary), access(openapiToBinary)]);
	const manifest = JSON.parse(
		await readFile(
			path.join(
				repositoryRoot,
				"packages",
				"cli",
				"dist",
				"skills",
				"manifest.json",
			),
			"utf8",
		),
	);
	const packagedRoot = path.join(
		repositoryRoot,
		"packages",
		"cli",
		"dist",
		"skills",
	);
	const humanDryRun = runAlias(
		"openapi",
		["skills", "install", "--host", "codex", "--dry-run"],
		environment,
		0,
		false,
	);
	if (
		!humanDryRun.stdout.includes("No files were written.") ||
		!humanDryRun.stdout.includes("Restart Codex")
	) {
		throw new Error("Cross-platform human dry-run contract failed");
	}
	for (const target of [codexHome, ...notifierConfigRoots]) {
		try {
			await access(target);
			throw new Error(
				"Cross-platform human dry-run wrote Codex or notifier state",
			);
		} catch (error) {
			if (!(error && error.code === "ENOENT")) throw error;
		}
	}
	const dryRun = runAlias(
		"openapi",
		["skills", "install", "--host", "codex", "--dry-run", "--json"],
		environment,
	);
	if (
		dryRun.success !== true ||
		dryRun.mode !== "dry-run" ||
		dryRun.restartRequired !== true
	) {
		throw new Error("Cross-platform Codex Skill dry-run contract failed");
	}
	try {
		await access(codexHome);
		throw new Error("Cross-platform Codex Skill dry-run created CODEX_HOME");
	} catch (error) {
		if (!(error && error.code === "ENOENT")) throw error;
	}
	const installed = runAlias(
		"openapi-to",
		["skills", "install", "--host", "codex", "--json"],
		environment,
	);
	if (
		installed.success !== true ||
		installed.installed?.join(",") !== "openapi-to-generate,openapi-to-setup" ||
		installed.restartRequired !== true
	) {
		throw new Error("Cross-platform Codex Skill install contract failed");
	}
	const installedRoot = path.join(codexHome, "skills");
	if (
		(await readdir(installedRoot)).sort().join(",") !==
		"openapi-to-generate,openapi-to-setup"
	) {
		throw new Error("Cross-platform Codex Skill installed file set failed");
	}
	if (
		JSON.stringify(await hashes(installedRoot, manifest)) !==
		JSON.stringify(await hashes(packagedRoot, manifest))
	) {
		throw new Error("Cross-platform Codex Skill installed byte check failed");
	}
	const second = runAlias(
		"openapi",
		["skills", "install", "--host", "codex", "--json"],
		environment,
		1,
	);
	if (
		second.success !== false ||
		!second.diagnostics?.some(
			({ code }) => code === "SKILLS_DESTINATION_CONFLICT",
		)
	) {
		throw new Error("Cross-platform Codex Skill conflict check failed");
	}
	process.stdout.write(
		`${JSON.stringify({
			success: true,
			platform: process.platform,
			binarySuffix: suffix,
			codexHomeContainsSpaces: true,
			skills: manifest.skills.length,
			files: manifest.skills.flatMap(({ files }) => files).length,
			checks: [
				"built-openapi-alias",
				"built-openapi-to-alias",
				process.platform === "win32" ? "windows-cmd-entry" : "posix-bin-entry",
				"codex-home-spaces-unicode",
				"human-dry-run-no-notifier",
				"dry-run-no-write",
				"two-skill-install",
				"installed-byte-verification",
				"existing-destination-rejection",
			],
		})}\n`,
	);
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}
