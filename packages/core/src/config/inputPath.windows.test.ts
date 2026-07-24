import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { loadSource } from "../openapi/sourceLoader.ts";
import type { OpenapiToConfigServer } from "../types";
import { selectConfiguredTargets } from "./configuredTargets.ts";

function server(inputPath: string): OpenapiToConfigServer {
	return {
		name: "windows",
		input: { path: inputPath },
		output: { dir: "generated" },
	};
}

describe.runIf(process.platform === "win32")(
	"Windows configured input filesystem boundary",
	() => {
		it("accepts an inside absolute file and rejects outside, drive-relative, UNC, and junction escapes", async () => {
			const root = await mkdtemp(path.join(os.tmpdir(), "openapi-input-root-"));
			const outside = await mkdtemp(
				path.join(os.tmpdir(), "openapi-input-outside-"),
			);
			try {
				const insideFile = path.join(root, "openapi.yaml");
				const outsideFile = path.join(outside, "outside.yaml");
				await writeFile(insideFile, "openapi: 3.1.0\n");
				await writeFile(outsideFile, "openapi: 3.1.0\n");
				expect(
					selectConfiguredTargets({ servers: [server(insideFile)] }),
				).toHaveLength(1);
				expect(
					(await loadSource(insideFile, { localFileRoot: root })).diagnostics,
				).toEqual([]);
				expect(
					(await loadSource(outsideFile, { localFileRoot: root }))
						.diagnostics[0]?.code,
				).toBe("LOCAL_SOURCE_OUTSIDE_ROOT");
				for (const inputPath of [
					"C:openapi.yaml",
					"C:folder\\openapi.yaml",
					"\\\\server\\share\\openapi.yaml",
				]) {
					expect(() =>
						selectConfiguredTargets({ servers: [server(inputPath)] }),
					).toThrowError(
						expect.objectContaining({
							diagnostics: [
								expect.objectContaining({
									code: "CONFIG_INPUT_PATH_INVALID",
								}),
							],
						}),
					);
				}
				const junction = path.join(root, "linked");
				await symlink(outside, junction, "junction");
				expect(
					(
						await loadSource(path.join(junction, "outside.yaml"), {
							localFileRoot: root,
						})
					).diagnostics[0]?.code,
				).toBe("LOCAL_SOURCE_SYMLINK_ESCAPE");
			} finally {
				await rm(root, { recursive: true, force: true });
				await rm(outside, { recursive: true, force: true });
			}
		});
	},
);
