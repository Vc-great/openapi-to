import { describe, expect, it } from "vitest";
import { buildJsonResponseTypes } from "./buildJsonResponseTypes.ts";

function initializer(statement: unknown): string {
	const declarations = (
		statement as { declarations?: { initializer?: unknown }[] }
	).declarations;
	return String(declarations?.[0]?.initializer);
}

describe("buildJsonResponseTypes", () => {
	it("maps an existing response Media Type Object without schema to z.unknown()", () => {
		const statements = buildJsonResponseTypes({
			accessor: {
				operationName: "emptyMedia",
				operation: {
					method: "get",
					schema: {
						responses: {
							"200": {
								description: "Any JSON value",
								content: { "application/json": {} },
							},
						},
					},
					getResponseStatusCodes: () => ["200"],
					getResponseAsJSONSchema: () => [],
				},
			},
		} as never);

		expect(initializer(statements[0])).toBe("z.unknown()");
	});
});
