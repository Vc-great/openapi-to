import type { OperationWrapper } from "@openapi-to/core";
import { describe, expect, it } from "vitest";
import { buildMethodBody } from "./buildMethodBody.ts";

function operationFor(response: unknown): OperationWrapper {
	return {
		path: "/response",
		accessor: {
			operation: {
				schema: { responses: { "200": response } },
				getResponseAsJSONSchema: () => [],
			},
		},
	} as unknown as OperationWrapper;
}

describe("REG-MSW-SCHEMALESS-JSON", () => {
	it("narrows unknown only at the schema-less JSON serialization boundary", () => {
		const schemaLess = buildMethodBody(
			operationFor({
				description: "Unknown JSON",
				content: { "application/json": {} },
			}),
			{ importWithExtension: true, responseDefaultType: "" },
		);
		expect(schemaLess).toContain(
			'HttpResponse.json(data as import("msw").JsonBodyType',
		);

		for (const response of [
			{
				description: "Known JSON",
				content: {
					"application/json": { schema: { type: "object" } },
				},
			},
			{ description: "No content" },
			{
				description: "Text",
				content: { "text/plain": {} },
			},
		]) {
			const body = buildMethodBody(operationFor(response), {
				importWithExtension: true,
				responseDefaultType: "",
			});
			expect(body).toContain("HttpResponse.json(data,");
			expect(body).not.toContain("JsonBodyType");
		}
	});
});
