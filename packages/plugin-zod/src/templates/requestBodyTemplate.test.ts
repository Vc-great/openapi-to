import { describe, expect, it } from "vitest";
import { buildComponentParameters } from "@/builds/components/buildComponentParameters.ts";
import { buildComponentsRequestBody } from "@/builds/components/buildComponentsRequestBody.ts";
import { buildComponentsResponse } from "@/builds/components/buildComponentsResponse.ts";
import { requestBodyTemplate } from "./requestBodyTemplate.ts";

function initializer(
	statement: ReturnType<typeof requestBodyTemplate>,
): string {
	expect(statement).toBeDefined();
	return String(statement?.declarations[0]?.initializer);
}

describe("request and component schema entry points", () => {
	it("maps an existing Media Type Object without schema to z.unknown()", () => {
		expect(initializer(requestBodyTemplate("anyBodySchema", {}))).toBe(
			"z.unknown()",
		);
		expect(
			initializer(
				buildComponentsRequestBody("AnyBody", {
					content: { "application/json": {} },
				} as never),
			),
		).toBe("z.unknown()");
	});

	it("keeps the first-declared media type selection policy", () => {
		expect(
			initializer(
				buildComponentsRequestBody("Multiple", {
					content: {
						"application/json": { schema: false },
						"text/plain": { schema: true },
					},
				} as never),
			),
		).toBe("z.never()");
		const response = buildComponentsResponse(
			{
				description: "Multiple",
				content: {
					"application/json": { schema: false },
					"text/plain": { schema: true },
				},
			} as never,
			"Multiple",
		);
		expect(String(response?.declarations[0]?.initializer)).toBe("z.never()");
	});

	it("does not skip a component response without content", () => {
		const statement = buildComponentsResponse(
			{ description: "No content" } as never,
			"NoContent",
		);
		expect(statement).toBeDefined();
		expect(String(statement?.declarations[0]?.initializer)).toBe(
			"z.undefined()",
		);
	});

	it("passes schema-level ref siblings through the renderer", () => {
		expect(
			initializer(
				requestBodyTemplate("bodySchema", {
					schema: {
						$ref: "#/components/schemas/BaseString",
						type: "string",
						minLength: 10,
					},
				} as never),
			),
		).toBe("z.intersection(baseStringSchema, z.string().min(10))");

		const parameter = buildComponentParameters(
			{
				name: "value",
				in: "query",
				schema: {
					$ref: "#/components/schemas/BaseString",
					type: "string",
					minLength: 10,
				},
			} as never,
			"LongValue",
		);
		expect(String(parameter?.declarations[0]?.initializer)).toBe(
			"z.intersection(baseStringSchema, z.string().min(10))",
		);
	});
});
