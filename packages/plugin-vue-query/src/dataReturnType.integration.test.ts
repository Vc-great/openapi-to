import path from "node:path";
import {
	PluginManager,
	type OpenAPIDocument,
	type OperationWrapper,
	pluginEnum,
} from "@openapi-to/core";
import { definePlugin as defineRequestPlugin } from "@openapi-to/plugin-ts-request";
import { definePlugin as defineTypePlugin } from "@openapi-to/plugin-ts-type";
import { describe, expect, it } from "vitest";
import { definePlugin } from "./plugin.ts";

function document(): OpenAPIDocument {
	return {
		openapi: "3.1.0",
		info: { title: "Composed envelopes", version: "1" },
		tags: [{ name: "tests" }],
		paths: {
			"/inline": {
				get: {
					operationId: "getInline",
					tags: ["tests"],
					responses: {
						"200": {
							description: "Inline envelope",
							content: {
								"application/json": {
									schema: {
										allOf: [
											{ $ref: "#/components/schemas/EnvelopeMetadata" },
											{
												type: "object",
												properties: { data: { type: "array" } },
											},
										],
									},
								},
							},
						},
					},
				},
			},
			"/referenced": {
				get: {
					operationId: "getReferenced",
					tags: ["tests"],
					responses: {
						"200": { $ref: "#/components/responses/EnvelopeResponse" },
					},
				},
			},
		},
		components: {
			responses: {
				EnvelopeResponse: {
					description: "Referenced envelope",
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/Envelope" },
						},
					},
				},
			},
			schemas: {
				Envelope: {
					allOf: [
						{ $ref: "#/components/schemas/EnvelopeMetadata" },
						{
							type: "object",
							properties: { data: { type: "array" } },
						},
					],
				},
				EnvelopeMetadata: {
					type: "object",
					properties: { meta: { type: "object" } },
				},
			},
		},
	} as OpenAPIDocument;
}

describe("composed response dataReturnType integration", () => {
	it("preserves configured return selection for inline and referenced allOf", async () => {
		const observedReturnTypes = new Map<string, string[]>();
		const result = await new PluginManager(
			{
				root: ".",
				input: { path: "openapi.json" },
				output: { dir: "test-output/composed-data-return" },
				plugins: [
					defineTypePlugin(),
					{
						name: "data-return-observer",
						dependencies: [pluginEnum.TsType],
						hooks: {
							operation(operation: OperationWrapper) {
								observedReturnTypes.set(
									operation.accessor.operationName,
									operation.accessor.dataReturnType,
								);
							},
						},
					},
					defineRequestPlugin({ dataReturnType: "data" }),
					definePlugin({ dataReturnType: "data" }),
				],
			},
			document(),
		).execute();

		expect(result.diagnostics).toEqual([]);
		expect(observedReturnTypes).toEqual(
			new Map([
				["getInline", ["meta", "data"]],
				["getReferenced", ["meta", "data"]],
			]),
		);
		const sources = Object.fromEntries(
			result.sourceFiles.map((sourceFile) => [
				path.basename(sourceFile.getFilePath()),
				sourceFile.getFullText(),
			]),
		);

		expect(sources["get-inline.service.ts"]).toContain("return res.data.data");
		expect(sources["get-referenced.service.ts"]).toContain(
			"return res.data.data",
		);
		expect(sources["use-get-inline.query.ts"]).toContain(
			"GetInlineResponse['data']",
		);
		expect(sources["use-get-referenced.query.ts"]).toContain(
			"GetReferencedResponse['data']",
		);
	});
});
