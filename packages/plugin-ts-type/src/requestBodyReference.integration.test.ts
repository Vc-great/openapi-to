import path from "node:path";
import { PluginManager } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { definePlugin } from "./plugin.ts";

describe("referenced request body enum generation", () => {
	it("keeps component enum identity out of operation imports and aliases", async () => {
		const manager = new PluginManager(
			{
				root: ".",
				input: { path: "openapi.json" },
				output: { dir: "test-output/referenced-request-body" },
				plugins: [definePlugin()],
			},
			{
				openapi: "3.1.0",
				info: { title: "Referenced request body", version: "1" },
				tags: [{ name: "tests" }],
				paths: {
					"/tests": {
						post: {
							operationId: "postTest",
							tags: ["tests"],
							requestBody: {
								$ref: "#/components/requestBodies/Input",
							},
							responses: { "204": { description: "created" } },
						},
					},
				},
				components: {
					requestBodies: {
						Input: {
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											kind: { type: "string", enum: ["a", "b"] },
										},
									},
								},
							},
						},
					},
				},
			},
		);

		const result = await manager.execute();
		expect(result.diagnostics).toEqual([]);

		const operationSource = result.sourceFiles.find(
			(sourceFile) =>
				path.basename(sourceFile.getFilePath()) === "post-test.types.ts",
		);
		const enumSource = result.sourceFiles.find(
			(sourceFile) =>
				path.basename(sourceFile.getFilePath()) === "enum.model.ts",
		);
		expect(operationSource?.getFullText()).toContain(
			"PostTestMutationRequest = RequestBodiesInputModel",
		);
		expect(operationSource?.getFullText()).not.toContain(
			"PostTestMutationRequestKindEnumValue",
		);
		expect(enumSource?.getFullText()).not.toContain(
			"postTestMutationRequestKindEnum",
		);
	});
});
