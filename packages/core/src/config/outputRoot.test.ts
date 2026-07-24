import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { OpenapiToConfigServer } from "../types";
import { selectConfiguredTargets } from "./configuredTargets.ts";
import {
	resolveConfiguredOutputRoot,
	resolveConfiguredTargetOutputs,
} from "./outputRoot.ts";

function target(
	name: string,
	output: OpenapiToConfigServer["output"],
): OpenapiToConfigServer {
	return { name, input: { path: "./openapi.yaml" }, output };
}

describe("configured output roots", () => {
	it("preserves managed defaults and supports explicit Workspace output", () => {
		const root = path.resolve("/workspace");
		expect(
			resolveConfiguredOutputRoot({
				workspaceRoot: root,
				output: { dir: "generated" },
			}),
		).toEqual({
			absolutePath: path.join(root, ".OpenAPI", "generated"),
			workspaceRelativePath: ".OpenAPI/generated",
			base: "managed",
		});
		expect(
			resolveConfiguredOutputRoot({
				workspaceRoot: root,
				output: { base: "workspace", dir: "src/api/generated" },
			}),
		).toEqual({
			absolutePath: path.join(root, "src", "api", "generated"),
			workspaceRelativePath: "src/api/generated",
			base: "workspace",
		});
	});

	it.each([
		[{ base: "workspace", dir: "." }, "CONFIG_OUTPUT_WORKSPACE_ROOT"],
		[{ base: "workspace", dir: "" }, "CONFIG_OUTPUT_PATH_INVALID"],
		[
			{ base: "workspace", dir: "../outside" },
			"CONFIG_OUTPUT_PATH_OUTSIDE_WORKSPACE",
		],
		[
			{ base: "workspace", dir: "/absolute" },
			"CONFIG_OUTPUT_PATH_OUTSIDE_WORKSPACE",
		],
		[
			{ base: "workspace", dir: "C:\\outside" },
			"CONFIG_OUTPUT_PATH_OUTSIDE_WORKSPACE",
		],
		[
			{ base: "workspace", dir: "C:outside" },
			"CONFIG_OUTPUT_PATH_OUTSIDE_WORKSPACE",
		],
		[
			{ base: "workspace", dir: "\\\\server\\share" },
			"CONFIG_OUTPUT_PATH_OUTSIDE_WORKSPACE",
		],
		[
			{ base: "workspace", dir: ".git/generated" },
			"CONFIG_OUTPUT_PROTECTED_PATH",
		],
		[
			{ base: "workspace", dir: "node_modules/generated" },
			"CONFIG_OUTPUT_PROTECTED_PATH",
		],
		[
			{ base: "workspace", dir: ".OpenAPI/selections" },
			"CONFIG_OUTPUT_PROTECTED_PATH",
		],
		[
			{ base: "workspace", dir: ".OpenAPI/transactions" },
			"CONFIG_OUTPUT_PROTECTED_PATH",
		],
		[
			{ base: "workspace", dir: ".OpenAPI/locks" },
			"CONFIG_OUTPUT_PROTECTED_PATH",
		],
	])("rejects unsafe output %#", (output, code) => {
		expect(() =>
			resolveConfiguredOutputRoot({
				workspaceRoot: "/workspace",
				output: output as OpenapiToConfigServer["output"],
			}),
		).toThrowError(
			expect.objectContaining({
				diagnostics: [expect.objectContaining({ code })],
			}),
		);
	});

	it("rejects equal, parent/child, and mixed-base overlaps", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "output-overlap-"));
		for (const servers of [
			[
				target("a", { base: "workspace", dir: "src/api" }),
				target("b", { base: "workspace", dir: "src/api" }),
			],
			[
				target("a", { base: "workspace", dir: "src/api" }),
				target("b", { base: "workspace", dir: "src/api/order" }),
			],
			[
				target("a", { dir: "generated" }),
				target("b", {
					base: "workspace",
					dir: ".OpenAPI/generated/order",
				}),
			],
		]) {
			await expect(
				resolveConfiguredTargetOutputs(
					root,
					selectConfiguredTargets({ servers }),
				),
			).rejects.toMatchObject({
				diagnostics: [
					expect.objectContaining({ code: "CONFIG_OUTPUT_OVERLAP" }),
				],
			});
		}
	});

	it("rejects an existing output parent symlink", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "output-symlink-"));
		const outside = await mkdtemp(path.join(os.tmpdir(), "output-outside-"));
		await mkdir(path.join(root, "src"));
		await symlink(outside, path.join(root, "src", "linked"), "dir");
		await expect(
			resolveConfiguredTargetOutputs(
				root,
				selectConfiguredTargets({
					servers: [
						target("target", {
							base: "workspace",
							dir: "src/linked/generated",
						}),
					],
				}),
			),
		).rejects.toMatchObject({
			diagnostics: [expect.objectContaining({ code: "CONFIG_OUTPUT_SYMLINK" })],
		});
	});
});
