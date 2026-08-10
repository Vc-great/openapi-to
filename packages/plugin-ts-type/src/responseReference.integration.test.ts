import path from "node:path";
import { PluginManager, type OpenAPIDocument } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { definePlugin } from "./plugin.ts";

function responseReferenceDocument(version: string): OpenAPIDocument {
	return {
		openapi: version,
		info: { title: `Referenced responses ${version}`, version: "1" },
		tags: [{ name: "tests" }],
		paths: {
			"/multi": {
				get: {
					operationId: "getMulti",
					tags: ["tests"],
					responses: {
						"200": {
							description: "Multiple media",
							content: {
								"application/xml": {
									schema: {
										type: "string",
										enum: ["must-not-be-collected"],
									},
								},
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: {
												type: "string",
												enum: ["ready", "pending"],
											},
										},
									},
								},
							},
						},
					},
				},
			},
			"/users": {
				get: {
					operationId: "getUser",
					tags: ["tests"],
					responses: {
						"201": { $ref: "#/components/responses/UserResponse" },
					},
				},
			},
			"/status": {
				get: {
					operationId: "getStatus",
					tags: ["tests"],
					responses: {
						"200": { $ref: "#/components/responses/StatusResponse" },
					},
				},
			},
		},
		components: {
			responses: {
				UserResponse: {
					description: "A user",
					content: {
						"application/xml": {
							schema: { type: "string", enum: ["ignored-user-xml"] },
						},
						"application/json": {
							schema: { $ref: "#/components/schemas/User" },
						},
					},
				},
				StatusResponse: {
					description: "A status",
					content: {
						"application/xml": {
							schema: { type: "string", enum: ["ignored-status-xml"] },
						},
						"application/json": {
							schema: {
								type: "object",
								properties: {
									status: {
										type: "string",
										enum: ["active", "inactive"],
									},
								},
								required: ["status"],
							},
						},
					},
				},
			},
			schemas: {
				User: {
					type: "object",
					properties: { id: { type: "string" } },
					required: ["id"],
				},
			},
		},
	} as OpenAPIDocument;
}

async function generate(document: OpenAPIDocument) {
	const result = await new PluginManager(
		{
			root: ".",
			input: { path: "openapi.json" },
			output: { dir: "test-output/referenced-responses" },
			plugins: [definePlugin()],
		},
		document,
	).execute();

	return {
		diagnostics: result.diagnostics,
		sources: Object.fromEntries(
			result.sourceFiles
				.map(
					(sourceFile) =>
						[
							path
								.relative("test-output/referenced-responses", sourceFile.getFilePath())
								.split(path.sep)
								.join("/"),
							sourceFile.getFullText(),
						] as const,
				)
				.sort(([left], [right]) => left.localeCompare(right)),
		),
	};
}

describe.each(["3.0.3", "3.1.0", "3.2.0"])(
	"referenced response generation for OpenAPI %s",
	(version) => {
		it("preserves component identity, component enums, input, and bytes", async () => {
			const document = responseReferenceDocument(version);
			const before = structuredClone(document);

			const first = await generate(document);

			expect(first.diagnostics).toEqual([]);
			expect(first.sources["tests/get-user.types.ts"]).toContain(
				"GetUserResponse201 = ResponseUserResponse",
			);
			expect(first.sources["tests/get-status.types.ts"]).toContain(
				"GetStatusResponse200 = ResponseStatusResponse",
			);
			expect(first.sources["tests/get-status.types.ts"]).not.toContain(
				"GetStatusResponse200StatusEnumValue",
			);
			expect(first.sources["tests/get-multi.types.ts"]).toContain(
				"interface GetMultiResponse200 {",
			);
			expect(first.sources["tests/get-multi.types.ts"]).toContain(
				"GetMultiResponse200Application_u2f_JsonStatusEnumValue",
			);
			expect(first.sources["tests/get-multi.types.ts"]).not.toContain(
				"ApplicationXml",
			);
			expect(first.sources["types/responses/status-response.model.ts"]).toContain(
				"ResponseStatusResponseStatusEnumValue",
			);
			expect(first.sources["types/responses/status-response.model.ts"]).not.toContain(
				"ApplicationXml",
			);
			expect(first.sources["types/enum.model.ts"]).toContain(
				"responseStatusResponseStatusEnum",
			);
			expect(document).toEqual(before);

			const second = await generate(document);
			expect(second).toEqual(first);
			expect(document).toEqual(before);
		});
	},
);
