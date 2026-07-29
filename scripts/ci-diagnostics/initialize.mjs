#!/usr/bin/env node

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { atomicWrite, ensureSafeDirectory, safeChild } from "./filesystem.mjs";
import { getPlan } from "./plans.mjs";
import { SCHEMA_VERSION } from "./schema.mjs";

export function parseInitializeArguments(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--dir" || argument === "--plan") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`${argument} requires a value.`);
			}
			result[argument.slice(2)] = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown initialize argument: ${argument}`);
	}
	if (!result.dir || !result.plan) {
		throw new Error("Usage: initialize.mjs --dir <directory> --plan <plan-id>");
	}
	return result;
}

export async function initialize(
	{ dir, plan: planId },
	environment = process.env,
) {
	const directory = await ensureSafeDirectory(dir, environment);
	const plan = getPlan(planId);
	for (const relativePath of [
		"commands",
		"known-reports",
		"ci-diagnostic.json",
		"summary.md",
		"plan.json",
	]) {
		await rm(safeChild(directory, relativePath), {
			recursive: true,
			force: true,
		});
	}
	await mkdir(safeChild(directory, "commands"), { recursive: true });
	await mkdir(safeChild(directory, "known-reports"), { recursive: true });
	await atomicWrite(
		safeChild(directory, "plan.json"),
		`${JSON.stringify(
			{
				schemaVersion: SCHEMA_VERSION,
				planId,
				workflow: plan.workflow,
				jobId: plan.jobId,
				jobName: plan.jobName,
				commands: plan.commands,
				reports: plan.reports.map(({ id, label, relativePath, format }) => ({
					id,
					label,
					relativePath,
					format,
				})),
			},
			null,
			2,
		)}\n`,
	);
	return directory;
}

async function main() {
	const options = parseInitializeArguments(process.argv.slice(2));
	const directory = await initialize(options);
	process.stdout.write(
		`[ci-diagnostics] initialized ${options.plan} in ${directory}\n`,
	);
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main().catch((error) => {
		process.stderr.write(
			`[ci-diagnostics] initialize failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}
